import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { handleRequest } from "../src/router.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

class MemoryKv {
  values = new Map();

  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return type === "json" && value ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }
}

class MemoryQuota {
  reservations = [];
  releases = [];

  async reserve(rules) {
    this.reservations.push(rules);
    return { allowed: true };
  }

  async release(rules) {
    this.releases.push(rules);
  }
}

class MemoryProjectPreviews {
  values = new Map();

  async put(previewVersion, value) {
    this.values.set(previewVersion, value);
    return "memory-preview-v1";
  }

  async get(previewVersion, consistencyToken) {
    if (consistencyToken !== "memory-preview-v1") return null;
    return this.values.get(previewVersion) ?? null;
  }
}

class MemoryCommunity {
  documents = new Map();
  writes = [];
  failUpsertKind = null;

  key(container, partitionKey, id) {
    return `${container}\n${partitionKey}\n${id}`;
  }

  async createDocument(container, doc, partitionKey) {
    const key = this.key(container, partitionKey, doc.id);
    if (this.documents.has(key)) throw new Error("conflict");
    this.documents.set(key, structuredClone(doc));
    this.writes.push({ operation: "create", kind: doc.kind, id: doc.id });
  }

  async readDocument(container, id, partitionKey) {
    return this.documents.get(this.key(container, partitionKey, id)) ?? null;
  }

  async upsertDocument(container, doc, partitionKey) {
    if (this.failUpsertKind === doc.kind) {
      this.failUpsertKind = null;
      throw new Error(`injected ${doc.kind} failure`);
    }
    this.documents.set(
      this.key(container, partitionKey, doc.id),
      structuredClone(doc),
    );
    this.writes.push({ operation: "upsert", kind: doc.kind, id: doc.id });
  }

  async deleteDocument(container, id, partitionKey) {
    this.documents.delete(this.key(container, partitionKey, id));
  }

  async queryDocuments() {
    return [];
  }
}

function projectEnv() {
  const rate = new MemoryKv();
  return {
    ALLOWED_ORIGINS: "https://curations.dev",
    RATE: rate,
    quota: new MemoryQuota(),
    projectPreviews: new MemoryProjectPreviews(),
    community: new MemoryCommunity(),
    requestMetadata: { clientIp: () => "203.0.113.9" },
    GITHUB_REPOSITORY_TOKEN: "read-only-token",
    SOFTWARE_TARGETS: "cloudflare,supabase",
    COSMOS_CONTAINER: "engagements",
    agentModel: {
      async chat() {
        throw new Error("Project evidence flow must not call a model");
      },
    },
  };
}

function addSession(env, user = { id: "123", login: "builder" }) {
  const token = "T".repeat(48);
  env.RATE.values.set(
    `session:${token}`,
    JSON.stringify({
      user: {
        provider: "github",
        id: user.id,
        login: user.login,
        name: "Builder",
        avatar_url: "https://avatars.example/builder",
        html_url: `https://github.com/${user.login}`,
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  );
  return token;
}

function installGithubFixture({
  owner = "builder",
  ownerId = 123,
  fork = false,
  archived = false,
  markerResponse,
} = {}) {
  const prd = [
    "# Public Project Plan",
    "",
    "This Project uses Cloudflare for a bounded public API.",
    "No production effectiveness claim is made.",
  ].join("\n");
  const commitSha = "a".repeat(40);
  const blobSha = "b".repeat(40);
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    calls.push({ url: value, headers: init.headers ?? {} });
    if (value === "https://api.github.com/repos/builder/public-project") {
      assert.equal(init.headers.authorization, "Bearer read-only-token");
      return Response.json({
        id: 987654,
        private: false,
        archived,
        fork,
        default_branch: "main",
        owner: { id: ownerId, login: owner, type: "User" },
      });
    }
    if (
      value ===
      "https://api.github.com/repos/builder/public-project/commits/main"
    ) {
      return Response.json({ sha: commitSha });
    }
    if (
      value ===
      `https://api.github.com/repos/builder/public-project/contents/docs/PRD.md?ref=${commitSha}`
    ) {
      return Response.json({
        type: "file",
        encoding: "base64",
        content: Buffer.from(prd).toString("base64"),
        sha: blobSha,
        size: Buffer.byteLength(prd),
      });
    }
    if (
      value ===
      `https://raw.githubusercontent.com/builder/public-project/${commitSha}/wrangler.toml`
    ) {
      if (markerResponse) return markerResponse();
      return new Response('name = "public-project"\nmain = "src/index.ts"\n');
    }
    if (value.includes("raw.githubusercontent.com")) {
      return new Response("not found", { status: 404 });
    }
    throw new Error(`Unexpected GitHub fixture request: ${value}`);
  };

  return { calls, prd, commitSha, blobSha };
}

function previewRequest(token, overrides = {}) {
  return new Request("https://api.curations.dev/api/projects/preview", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "https://curations.dev",
    },
    body: JSON.stringify({
      repository_url: "https://github.com/builder/public-project",
      prd_path: "docs/PRD.md",
      summary:
        "A public Project used to prove exact preview-bound consent without AI.",
      question: "Which decision should this Project resolve before persistence?",
      project_type: "developer-tools",
      approved_excerpt: "This Project uses Cloudflare for a bounded public API.",
      tools: [
        {
          tool_id: "cloudflare",
          declared_use: "Hosts the bounded public API described by the builder.",
          declared_in_prd: true,
          stack_path: "",
        },
      ],
      ...overrides,
    }),
  });
}

test("Project preview requires GitHub identity", async () => {
  const env = projectEnv();
  const response = await handleRequest(
    previewRequest("X".repeat(48)),
    env,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "GitHub sign-in required.",
  });
});

test("Project preview rejects non-owner, forked, and archived repositories", async () => {
  for (const fixture of [
    { owner: "someone-else" },
    { ownerId: 999 },
    { fork: true },
    { archived: true },
  ]) {
    const env = projectEnv();
    const token = addSession(env);
    installGithubFixture(fixture);
    const response = await handleRequest(previewRequest(token), env);
    assert.equal(response.status >= 400, true);
    assert.equal(JSON.stringify(await response.json()).includes("token"), false);
  }
});

test("exact preview creates no public Project and exposes no PRD body", async () => {
  const env = projectEnv();
  const token = addSession(env);
  const github = installGithubFixture();
  const response = await handleRequest(previewRequest(token), env);
  assert.equal(response.status, 200);
  const result = await response.json();

  assert.match(result.preview_version, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.preview.status, "preview");
  assert.equal(result.preview.project_id, "github-repository:987654");
  assert.equal(result.preview.repository.commit_sha, github.commitSha);
  assert.equal(result.preview.snapshot.prd.blob_sha, github.blobSha);
  assert.match(result.preview.snapshot.prd.content_sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    result.preview.snapshot.prd.source_url,
    `https://github.com/builder/public-project/blob/${github.commitSha}/docs/PRD.md`,
  );
  assert.equal(result.preview.claims[0].declared_in_prd, true);
  assert.equal(result.preview.claims[0].observations[0].matched, true);
  assert.equal(
    result.preview.claims[0].observations[0].rule_id,
    "cloudflare.wrangler-toml",
  );
  assert.equal(
    result.preview.claims[0].observations[0].rule_version,
    "1.0.0",
  );
  assert.match(
    result.preview.claims[0].observations[0].limitation,
    /literal configuration signal only/,
  );
  assert.equal(env.community.documents.size, 0);
  assert.equal(JSON.stringify(result).includes(github.prd), false);
  assert.equal(JSON.stringify(result).includes("production effectiveness"), false);
});

test("explicit consent creates pending Project, Snapshot, and ToolClaim idempotently", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const previewResponse = await handleRequest(previewRequest(token), env);
  const preview = await previewResponse.json();
  const requestId = "11111111-1111-4111-8111-111111111111";
  const createRequest = () =>
    new Request("https://api.curations.dev/api/projects", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        origin: "https://curations.dev",
      },
      body: JSON.stringify({
        project_id: preview.preview.project_id,
        preview_version: preview.preview_version,
        preview_consistency_token: preview.preview_consistency_token,
        request_id: requestId,
        consent: true,
      }),
    });

  const created = await handleRequest(createRequest(), env);
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.project.status, "pending");
  assert.equal(
    createdBody.project.consent.preview_version,
    preview.preview_version,
  );
  assert.equal(createdBody.project.repository.github_id, 987654);

  const documents = [...env.community.documents.values()];
  assert.deepEqual(
    documents.map((doc) => doc.kind).sort(),
    ["project", "project-snapshot", "project-tool-claim"],
  );
  assert.equal(JSON.stringify(documents).includes("Public Project Plan"), false);
  assert.equal(
    documents.every(
      (doc) => doc.project_id === "github-repository:987654",
    ),
    true,
  );
  const snapshot = documents.find((doc) => doc.kind === "project-snapshot");
  assert.deepEqual(snapshot.limitations, preview.preview.limitations);
  const claim = documents.find((doc) => doc.kind === "project-tool-claim");
  assert.match(claim.claim.observations[0].limitation, /does not prove runtime use/);

  env.projectPreviews.values.delete(preview.preview_version);
  const retried = await handleRequest(createRequest(), env);
  assert.equal(retried.status, 200);
  assert.equal(env.community.documents.size, 3);

  const conflicting = await handleRequest(
    new Request("https://api.curations.dev/api/projects", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        origin: "https://curations.dev",
      },
      body: JSON.stringify({
        project_id: preview.preview.project_id,
        preview_version: preview.preview_version,
        preview_consistency_token: preview.preview_consistency_token,
        request_id: "22222222-2222-4222-8222-222222222222",
        consent: true,
      }),
    }),
    env,
  );
  assert.equal(conflicting.status, 409);
});

test("Project creation rejects absent consent and expired or foreign previews", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const previewResponse = await handleRequest(previewRequest(token), env);
  const preview = await previewResponse.json();

  const noConsent = await handleRequest(
    new Request("https://api.curations.dev/api/projects", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        project_id: preview.preview.project_id,
        preview_version: preview.preview_version,
        preview_consistency_token: preview.preview_consistency_token,
        request_id: "33333333-3333-4333-8333-333333333333",
        consent: false,
      }),
    }),
    env,
  );
  assert.equal(noConsent.status, 400);

  const stored = JSON.parse(
    env.projectPreviews.values.get(preview.preview_version),
  );
  stored.expires_at = new Date(Date.now() - 1_000).toISOString();
  env.projectPreviews.values.set(preview.preview_version, JSON.stringify(stored));
  const expired = await handleRequest(
    new Request("https://api.curations.dev/api/projects", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        project_id: preview.preview.project_id,
        preview_version: preview.preview_version,
        preview_consistency_token: preview.preview_consistency_token,
        request_id: "44444444-4444-4444-8444-444444444444",
        consent: true,
      }),
    }),
    env,
  );
  assert.equal(expired.status, 409);
});

test("Project endpoints reject oversized bodies before quota or JSON parsing", async () => {
  const env = projectEnv();
  const token = addSession(env);
  const response = await handleRequest(
    new Request("https://api.curations.dev/api/projects/preview", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ padding: "x".repeat(300_001) }),
    }),
    env,
  );
  assert.equal(response.status, 413);
  assert.equal(env.quota.reservations.length, 0);
});

test("Project pilot accepts only Cloudflare or Supabase declarations", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const response = await handleRequest(
    previewRequest(token, {
      tools: [
        {
          tool_id: "zotero",
          declared_use: "Stores source references selected by the builder.",
          declared_in_prd: true,
          stack_path: "",
        },
      ],
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /supported tools/);
});

test("approved excerpt must be exact text from the pinned PRD", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const response = await handleRequest(
    previewRequest(token, {
      approved_excerpt: "This sentence is not in the selected PRD.",
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "approved_excerpt must be exact text from the selected PRD revision",
  });
});

test("unavailable or oversized evidence never becomes fresh negative evidence", async () => {
  const unavailableEnv = projectEnv();
  const unavailableToken = addSession(unavailableEnv);
  installGithubFixture({
    markerResponse: () => new Response("rate limited", { status: 429 }),
  });
  const unavailable = await handleRequest(
    previewRequest(unavailableToken),
    unavailableEnv,
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailableEnv.projectPreviews.values.size, 0);

  const oversizedEnv = projectEnv();
  const oversizedToken = addSession(oversizedEnv);
  installGithubFixture({
    markerResponse: () =>
      new Response("x".repeat(128_001), {
        headers: { "content-type": "text/plain" },
      }),
  });
  const oversized = await handleRequest(
    previewRequest(oversizedToken),
    oversizedEnv,
  );
  assert.equal(oversized.status, 400);
  assert.match((await oversized.json()).error, /exceeds the 128000-byte limit/);
});

test("different consented previews produce different snapshot identities", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const first = await handleRequest(previewRequest(token), env);
  const firstBody = await first.json();
  const second = await handleRequest(
    previewRequest(token, {
      approved_excerpt: "No production effectiveness claim is made.",
    }),
    env,
  );
  const secondBody = await second.json();
  assert.notEqual(
    firstBody.preview.snapshot.id,
    secondBody.preview.snapshot.id,
  );
});

test("losing concurrent request never deletes the winning Project evidence", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const previewResponse = await handleRequest(previewRequest(token), env);
  const preview = await previewResponse.json();
  const create = (requestId) =>
    handleRequest(
      new Request("https://api.curations.dev/api/projects", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          project_id: preview.preview.project_id,
          preview_version: preview.preview_version,
          preview_consistency_token: preview.preview_consistency_token,
          request_id: requestId,
          consent: true,
        }),
      }),
      env,
    );

  const responses = await Promise.all([
    create("66666666-6666-4666-8666-666666666666"),
    create("77777777-7777-4777-8777-777777777777"),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.deepEqual(
    [...env.community.documents.values()].map((doc) => doc.kind).sort(),
    ["project", "project-snapshot", "project-tool-claim"],
  );
  assert.equal(env.quota.releases.length, 1);
});

test("failed evidence persistence leaves no Project and releases create quota", async () => {
  const env = projectEnv();
  const token = addSession(env);
  installGithubFixture();
  const previewResponse = await handleRequest(previewRequest(token), env);
  const preview = await previewResponse.json();
  env.community.failUpsertKind = "project-tool-claim";

  const response = await handleRequest(
    new Request("https://api.curations.dev/api/projects", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        project_id: preview.preview.project_id,
        preview_version: preview.preview_version,
        preview_consistency_token: preview.preview_consistency_token,
        request_id: "55555555-5555-4555-8555-555555555555",
        consent: true,
      }),
    }),
    env,
  );

  assert.equal(response.status, 502);
  assert.deepEqual(
    [...env.community.documents.values()].map((doc) => doc.kind),
    ["project-snapshot"],
  );
  assert.equal(
    [...env.community.documents.values()].some((doc) => doc.kind === "project"),
    false,
  );
  assert.equal(env.quota.releases.length, 1);
});
