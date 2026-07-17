import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/router.ts";

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

class MemoryCommunity {
  documents = new Map();
  etag = 0;

  key(container, partition, id) {
    return `${container}\n${partition}\n${id}`;
  }

  seed(container, partition, doc) {
    this.etag += 1;
    this.documents.set(this.key(container, partition, doc.id), {
      ...structuredClone(doc),
      _etag: `etag-${this.etag}`,
    });
  }

  async createDocument(container, doc, partition) {
    const key = this.key(container, partition, doc.id);
    if (this.documents.has(key)) throw new Error("conflict");
    this.etag += 1;
    this.documents.set(key, {
      ...structuredClone(doc),
      _etag: `etag-${this.etag}`,
    });
  }

  async readDocument(container, id, partition) {
    return this.documents.get(this.key(container, partition, id)) ?? null;
  }

  async upsertDocument(container, doc, partition) {
    this.etag += 1;
    this.documents.set(this.key(container, partition, doc.id), {
      ...structuredClone(doc),
      _etag: `etag-${this.etag}`,
    });
  }

  async replaceDocument(container, id, doc, partition, etag) {
    const key = this.key(container, partition, id);
    const existing = this.documents.get(key);
    if (!existing || existing._etag !== etag) return false;
    this.etag += 1;
    this.documents.set(key, {
      ...structuredClone(doc),
      _etag: `etag-${this.etag}`,
    });
    return true;
  }

  async deleteDocument(container, id, partition) {
    this.documents.delete(this.key(container, partition, id));
  }

  async queryDocuments(container, _query, parameters, partition) {
    const values = new Map(parameters.map((parameter) => [parameter.name, parameter.value]));
    return [...this.documents.entries()]
      .filter(([key]) => key.startsWith(`${container}\n${partition}\n`))
      .map(([, doc]) => doc)
      .filter((doc) => {
        if (values.has("@kind") && doc.kind !== values.get("@kind")) return false;
        if (
          values.has("@snapshot") &&
          doc.snapshot_id !== values.get("@snapshot")
        ) {
          return false;
        }
        return true;
      });
  }

  async queryDocumentsCrossPartition(container, _query, parameters) {
    const values = new Map(parameters.map((parameter) => [parameter.name, parameter.value]));
    return [...this.documents.entries()]
      .filter(([key]) => key.startsWith(`${container}\n`))
      .map(([, doc]) => doc)
      .filter((doc) => {
        if (values.has("@kind") && doc.kind !== values.get("@kind")) return false;
        if (values.has("@status") && doc.status !== values.get("@status")) return false;
        if (values.has("@route") && doc.route_key !== values.get("@route")) return false;
        return true;
      });
  }
}

function reviewEnv() {
  return {
    ALLOWED_ORIGINS: "https://curations.dev",
    RATE: new MemoryKv(),
    quota: new MemoryQuota(),
    community: new MemoryCommunity(),
    requestMetadata: { clientIp: () => "203.0.113.9" },
    PROJECT_MAINTAINER_GITHUB_IDS: "999",
    COSMOS_CONTAINER: "engagements",
  };
}

function addSession(env, id, login) {
  const token = `${id}`.padEnd(48, "T");
  env.RATE.values.set(
    `session:${token}`,
    JSON.stringify({
      user: {
        provider: "github",
        id,
        login,
        name: login,
        avatar_url: `https://avatars.example/${login}`,
        html_url: `https://github.com/${login}`,
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  );
  return token;
}

function projectFixture(status = "pending", visibility = "hidden") {
  const projectId = "github-repository:987654";
  return {
    id: projectId,
    project_id: projectId,
    tool_id: projectId,
    kind: "project",
    route_key: "builder/public-project",
    repository: {
      github_id: 987654,
      owner: "builder",
      name: "public-project",
      url: "https://github.com/builder/public-project",
      fork: false,
      archived: false,
      default_branch: "main",
      commit_sha: "a".repeat(40),
    },
    submitted_by: { github_user_id: "123", login: "builder" },
    consent: {
      method: "owner-login-match",
      preview_version: `sha256:${"c".repeat(64)}`,
      confirmed_at: "2026-07-17T00:00:00.000Z",
    },
    summary: "A bounded public Project summary.",
    question: "Which decision should this Project resolve next?",
    project_type: "developer-tools",
    status,
    visibility,
    current_snapshot_id: `snapshot:${projectId}:${"d".repeat(64)}`,
    request_id: "11111111-1111-4111-8111-111111111111",
    review_history: [],
    revocation_history: [],
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
  };
}

function seedProject(env, status = "pending", visibility = "hidden") {
  const project = projectFixture(status, visibility);
  const partition = project.project_id;
  env.community.seed("engagements", partition, project);
  env.community.seed("engagements", partition, {
    id: project.current_snapshot_id,
    project_id: partition,
    tool_id: partition,
    kind: "project-snapshot",
    repository_commit: "a".repeat(40),
    default_branch: "main",
    prd: {
      path: "docs/PRD.md",
      blob_sha: "b".repeat(40),
      content_sha256: "e".repeat(64),
      source_url:
        `https://github.com/builder/public-project/blob/${"a".repeat(40)}/docs/PRD.md`,
      approved_excerpt: "A bounded public excerpt.",
    },
    checker_version: "project-evidence/0.1.0",
    checked_at: "2026-07-17T00:00:00.000Z",
    fresh_until: "2026-08-16T00:00:00.000Z",
    limitations: ["Literal evidence only; not production-use proof."],
  });
  env.community.seed("engagements", partition, {
    id: `tool-claim:${project.current_snapshot_id}:cloudflare`,
    project_id: partition,
    tool_id: partition,
    kind: "project-tool-claim",
    snapshot_id: project.current_snapshot_id,
    claim: {
      tool_id: "cloudflare",
      declared_use: "Hosts a bounded public API.",
      declared_in_prd: true,
      stack_path: null,
      observations: [
        {
          rule_id: "cloudflare.wrangler-toml",
          rule_version: "1.0.0",
          path: "wrangler.toml",
          label: "Wrangler configuration",
          matched: true,
          limitation: "Literal configuration signal only.",
        },
      ],
    },
  });
  return project;
}

function authHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    origin: "https://curations.dev",
  };
}

function reviewRequest(token, action, requestId, reason = "Reviewed exact public claims.") {
  return new Request("https://api.curations.dev/api/projects/review", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: "github-repository:987654",
      action,
      reason,
      request_id: requestId,
    }),
  });
}

test("Project review queue requires configured maintainer identity", async () => {
  const env = reviewEnv();
  seedProject(env);
  const builder = addSession(env, "123", "builder");
  const forbidden = await handleRequest(
    new Request("https://api.curations.dev/api/projects/review?status=pending", {
      headers: authHeaders(builder),
    }),
    env,
  );
  assert.equal(forbidden.status, 403);

  const maintainer = addSession(env, "999", "maintainer");
  const allowed = await handleRequest(
    new Request("https://api.curations.dev/api/projects/review?status=pending", {
      headers: authHeaders(maintainer),
    }),
    env,
  );
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0].status, "pending");
});

test("maintainer approval publishes without endorsement and enables public read", async () => {
  const env = reviewEnv();
  seedProject(env);
  const maintainer = addSession(env, "999", "maintainer");
  const requestId = "22222222-2222-4222-8222-222222222222";
  const approved = await handleRequest(
    reviewRequest(maintainer, "approve", requestId),
    env,
  );
  assert.equal(approved.status, 200);
  const approval = await approved.json();
  assert.equal(approval.project.status, "published");
  assert.equal(approval.project.visibility, "public");
  assert.match(approval.publication_note, /not endorsement/);

  const retried = await handleRequest(
    reviewRequest(maintainer, "approve", requestId),
    env,
  );
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).project.review_history.length, 1);

  const publicRead = await handleRequest(
    new Request(
      "https://api.curations.dev/api/projects/builder/public-project",
    ),
    env,
  );
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get("cache-control"), "no-store");
  const published = await publicRead.json();
  assert.equal(published.project.status, "published");
  assert.equal(published.snapshot.tool_id, undefined);
  assert.equal(published.project.request_id, undefined);
  assert.equal(published.project.review_history, undefined);
  assert.equal(published.claims[0].observations[0].matched, true);
  assert.match(published.publication_note, /not endorsement/);
});

test("hide and restore control public visibility without changing evidence state", async () => {
  const env = reviewEnv();
  seedProject(env, "published", "public");
  const maintainer = addSession(env, "999", "maintainer");
  const hidden = await handleRequest(
    reviewRequest(
      maintainer,
      "hide",
      "33333333-3333-4333-8333-333333333333",
      "Temporarily hidden for source review.",
    ),
    env,
  );
  assert.equal(hidden.status, 200);
  assert.equal((await hidden.json()).project.status, "published");
  assert.equal(
    (
      await handleRequest(
        new Request(
          "https://api.curations.dev/api/projects/builder/public-project",
        ),
        env,
      )
    ).status,
    404,
  );

  const restored = await handleRequest(
    reviewRequest(
      maintainer,
      "restore",
      "44444444-4444-4444-8444-444444444444",
      "Source and public claims were rechecked.",
    ),
    env,
  );
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).project.visibility, "public");
});

test("return and reject enforce legal Project transitions", async () => {
  const env = reviewEnv();
  seedProject(env);
  const maintainer = addSession(env, "999", "maintainer");
  const returned = await handleRequest(
    reviewRequest(
      maintainer,
      "return",
      "55555555-5555-4555-8555-555555555555",
      "Builder must clarify the approved excerpt.",
    ),
    env,
  );
  assert.equal(returned.status, 200);
  assert.equal((await returned.json()).project.status, "draft");

  const rejected = await handleRequest(
    reviewRequest(
      maintainer,
      "reject",
      "66666666-6666-4666-8666-666666666666",
      "Owner withdrew this pending submission.",
    ),
    env,
  );
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).project.status, "rejected");

  const illegal = await handleRequest(
    reviewRequest(
      maintainer,
      "approve",
      "77777777-7777-4777-8777-777777777777",
    ),
    env,
  );
  assert.equal(illegal.status, 409);
});

test("builder can revoke and remove a published Project from public reads", async () => {
  const env = reviewEnv();
  seedProject(env, "published", "public");
  const builder = addSession(env, "123", "builder");
  const response = await handleRequest(
    new Request("https://api.curations.dev/api/projects/revoke", {
      method: "POST",
      headers: authHeaders(builder),
      body: JSON.stringify({
        project_id: "github-repository:987654",
        reason: "Builder withdrew publication consent.",
        request_id: "88888888-8888-4888-8888-888888888888",
      }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  const revoked = await response.json();
  assert.equal(revoked.project.status, "revoked");
  assert.equal(revoked.project.visibility, "hidden");
  assert.equal(revoked.project.revocation_history.length, 1);

  const publicRead = await handleRequest(
    new Request(
      "https://api.curations.dev/api/projects/builder/public-project",
    ),
    env,
  );
  assert.equal(publicRead.status, 404);
});
