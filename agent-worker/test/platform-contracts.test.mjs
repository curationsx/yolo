import assert from "node:assert/strict";
import test from "node:test";

import {
  createCloudflareAgentModelClient,
  createCloudflareCommunityStore,
  createCloudflareCopilotGrantStore,
  createCloudflareCopilotRuntimeClient,
  createCloudflareQuotaStore,
  createCloudflareReadinessProbe,
  createCloudflareRequestMetadata,
  createCloudflareVoteStore,
} from "../src/platform/cloudflare.ts";import { encryptCopilotToken } from "../src/copilot-grant.ts";

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

class DoNamespace {
  constructor(handler) {
    this.handler = handler;
  }

  idFromName(name) {
    return name;
  }

  get(id) {
    return {
      fetch: async (urlOrRequest, init) => {
        if (urlOrRequest instanceof Request) {
          const body = await urlOrRequest.clone().text();
          return this.handler(id, urlOrRequest.url, { method: urlOrRequest.method, body });
        }
        return this.handler(id, urlOrRequest, init ?? {});
      },
    };
  }
}

test("Cloudflare quota store reserves and releases through the Durable Object binding", async () => {
  const calls = [];
  const namespace = new DoNamespace(async (id, url, init) => {
    calls.push({ id, path: new URL(url).pathname, body: JSON.parse(init.body) });
    return Response.json({ allowed: true });
  });
  const store = createCloudflareQuotaStore(namespace);
  assert.deepEqual(await store.reserve([{ key: "user:1", limit: 5 }]), { allowed: true });
  await store.release([{ key: "user:1", limit: 5 }]);
  assert.equal(calls[0].path, "/reserve");
  assert.equal(calls[1].body.action, "release");
});

test("Cloudflare Copilot grant store puts, consumes, checks status, and revokes through the Durable Object", async () => {
  const grants = new Map();
  const namespace = new DoNamespace(async (id, url, init) => {
    const path = new URL(url).pathname;
    if (path === "/put") {
      grants.set(id, JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    if (path === "/status") {
      const grant = grants.get(id);
      return grant
        ? Response.json({ connected: true, expires_at: grant.expires_at })
        : Response.json({ connected: false, expires_at: null });
    }
    if (path === "/consume") {
      const grant = grants.get(id);
      if (!grant) return Response.json({ error: "not found" }, { status: 404 });
      grants.delete(id);
      return Response.json(grant);
    }
    if (path === "/revoke") {
      grants.delete(id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  });
  const store = createCloudflareCopilotGrantStore(namespace);
  const grant = await encryptCopilotToken(
    `gho_${"A".repeat(36)}`,
    "123",
    new Date(Date.now() + 60_000).toISOString(),
    Buffer.alloc(32, 1).toString("base64url"),
  );
  const sessionA = "A".repeat(48);
  const sessionB = "B".repeat(48);
  await store.put(sessionA, grant);

  assert.deepEqual(await store.status(sessionA), { connected: true, expires_at: grant.expires_at });
  const consumed = await store.consume(sessionA);
  assert.deepEqual(consumed, grant);
  assert.deepEqual(await store.status(sessionA), { connected: false, expires_at: null });

  grants.set(sessionB, grant);
  await store.revoke(sessionB);
  assert.deepEqual(await store.status(sessionB), { connected: false, expires_at: null });
});

test("Cloudflare request metadata trusts only cf-connecting-ip", () => {
  const metadata = createCloudflareRequestMetadata();
  const request = new Request("https://api.curations.dev/api/health", {
    headers: { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1" },
  });
  assert.equal(metadata.clientIp(request), "203.0.113.9");
  assert.equal(metadata.clientIp(new Request("https://api.curations.dev/api/health")), "unknown");
});

test("Cloudflare agent model client sends an api-key header, never a bearer token", async () => {
  let capturedHeaders;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    return Response.json({
      choices: [{ message: { content: "hi" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };
  try {
    const client = createCloudflareAgentModelClient({
      endpoint: "https://yolo-foundry.cognitiveservices.azure.com",
      apiKey: "test-api-key",
      deployment: "gpt-5.4-mini",
    });
    const result = await client.chat("system", "message", 100);
    assert.equal(result.text, "hi");
    assert.equal(capturedHeaders["api-key"], "test-api-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudflare Copilot runtime client forwards the run payload to the Container binding", async () => {
  const namespace = new DoNamespace(async (_id, _url, init) => {
    const body = JSON.parse(init.body);
    return Response.json({ content: `Reviewed ${body.runId}`, model: body.model });
  });
  const client = createCloudflareCopilotRuntimeClient(namespace);
  const result = await client.run(
    { gitHubToken: "gho_x", prompt: "hello", runId: "run-1", model: "gpt-5.4", maxAiCredits: 10 },
    5_000,
  );
  assert.equal(result.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.body.content, "Reviewed run-1");
});

test("Cloudflare Copilot runtime client tolerates a non-JSON response body", async () => {
  const namespace = new DoNamespace(async () => new Response("not json", { status: 502 }));
  const client = createCloudflareCopilotRuntimeClient(namespace);
  const result = await client.run(
    { gitHubToken: "gho_x", prompt: "hello", runId: "run-1", model: "gpt-5.4", maxAiCredits: 10 },
    5_000,
  );
  assert.deepEqual(result, { status: 502, ok: false, body: null });
});

test("Cloudflare readiness probe reports every configuration flag", async () => {
  const readyProbe = createCloudflareReadinessProbe({ github: true, cosmos: true });
  assert.deepEqual(await readyProbe.check(), { ready: true, checks: { github: "ok", cosmos: "ok" } });

  const notReadyProbe = createCloudflareReadinessProbe({ github: false, cosmos: true });
  const result = await notReadyProbe.check();
  assert.equal(result.ready, false);
  assert.equal(result.checks.github, "error");
});

class MemoryDoStorage {
  values = new Map();
  async get(keyOrKeys) {
    if (Array.isArray(keyOrKeys)) {
      const result = new Map();
      for (const key of keyOrKeys) if (this.values.has(key)) result.set(key, this.values.get(key));
      return result;
    }
    return this.values.get(keyOrKeys);
  }
  async put(keyOrEntries, value) {
    if (typeof keyOrEntries === "string") this.values.set(keyOrEntries, value);
    else for (const [key, entryValue] of Object.entries(keyOrEntries)) this.values.set(key, entryValue);
  }
  async delete(key) {
    this.values.delete(key);
  }
  async list({ prefix } = {}) {
    const result = new Map();
    for (const [key, value] of this.values) if (!prefix || key.startsWith(prefix)) result.set(key, value);
    return result;
  }
}

/** Builds a VoteGuard Durable Object backed by an in-memory fake of the
 * master-key Cosmos REST client, installing `globalThis.fetch` for the
 * duration of the harness. Callers must call `restore()` (e.g. in a
 * `finally` block) to uninstall the fetch mock. */
async function createVoteGuardHarness() {
  const { VoteGuard } = await import("../src/vote-guard.ts");
  const documents = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    const isQuery = init.headers?.["x-ms-documentdb-isquery"] === "true";
    if (init.method === "POST" && isQuery) {
      const body = JSON.parse(init.body);
      const partitionKey = JSON.parse(init.headers["x-ms-documentdb-partitionkey"])[0];
      const scoped = [...documents.values()].filter((doc) => doc.__partition === partitionKey);
      if (body.query.includes("COUNT(1)")) {
        // Simulate real Cosmos SQL's IS_DEFINED semantics so this mock
        // actually proves the vote-only count predicate, rather than
        // trivially counting every document in the partition.
        const isVoteOnlyCount = body.query.includes("IS_DEFINED");
        const countable = isVoteOnlyCount
          ? scoped.filter((doc) => doc.id !== "score" && (!Object.hasOwn(doc, "doc_type") || doc.doc_type === "vote"))
          : scoped;
        return Response.json({ Documents: [countable.length] });
      }
      return Response.json({ Documents: scoped });
    }
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      const partitionKey = JSON.parse(init.headers["x-ms-documentdb-partitionkey"])[0];
      documents.set(`${partitionKey}::${body.id}`, { ...body, __partition: partitionKey });
      return Response.json(body, { status: 201 });
    }
    if (init.method === "GET") {
      const id = decodeURIComponent(parsed.pathname.split("/").pop());
      const partitionKey = JSON.parse(init.headers["x-ms-documentdb-partitionkey"])[0];
      const doc = documents.get(`${partitionKey}::${id}`);
      return doc ? Response.json(doc) : new Response(null, { status: 404 });
    }
    if (init.method === "DELETE") {
      const id = decodeURIComponent(parsed.pathname.split("/").pop());
      const partitionKey = JSON.parse(init.headers["x-ms-documentdb-partitionkey"])[0];
      documents.delete(`${partitionKey}::${id}`);
      return new Response(null, { status: 204 });
    }
    return Response.json({ error: "unsupported" }, { status: 400 });
  };

  const voteGuardEnv = {
    RATE: new MemoryKv(),
    COSMOS_ENDPOINT: "https://yolo-curations-feed.documents.azure.com",
    COSMOS_KEY: Buffer.from("test-key").toString("base64"),
    COSMOS_DATABASE: "curations",
    COSMOS_VOTES_CONTAINER: "votes",
    COSMOS_SCORES_CONTAINER: "scores",
  };
  const instances = new Map();
  const namespace = {
    idFromName: (name) => name,
    get: (id) => {
      let instance = instances.get(id);
      if (!instance) {
        instance = new VoteGuard({ storage: new MemoryDoStorage() }, voteGuardEnv);
        instances.set(id, instance);
      }
      return { fetch: (url, init) => instance.fetch(new Request(url, init)) };
    },
  };
  const store = createCloudflareVoteStore({ ...voteGuardEnv, VOTE_GUARD: namespace });

  return {
    documents,
    store,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test("Cloudflare vote store delegates to the durable VoteGuard Durable Object and Cosmos REST", async () => {
  const harness = await createVoteGuardHarness();
  try {
    const first = await harness.store.setVote("software:cloudflare", "123", true);
    assert.deepEqual(first, { target_id: "software:cloudflare", voted: true, count: 1 });
    assert.deepEqual(await harness.store.getViewerVotes("123", ["software:cloudflare"]), ["software:cloudflare"]);

    // getCounts must read the same legacy `scores` container the durable
    // VoteGuard's mutate() already keeps current on every vote — no
    // behavior change for Cloudflare.
    assert.deepEqual(await harness.store.getCounts(["software:cloudflare"]), { "software:cloudflare": 1 });

    const removed = await harness.store.setVote("software:cloudflare", "123", false);
    assert.deepEqual(removed, { target_id: "software:cloudflare", voted: false, count: 0 });
    assert.deepEqual(await harness.store.getCounts(["software:cloudflare"]), { "software:cloudflare": 0 });
  } finally {
    harness.restore();
  }
});

test("legacy Cloudflare vote counting excludes a same-partition Azure score metadata document", async () => {
  // Regression test for the dual-cloud race: once a pre-cutover backfill
  // (or Azure vote traffic) creates the same-partition score metadata
  // document (`id: "score"`, `doc_type: "score"`) in the votes container,
  // the legacy Cloudflare Worker's own count query must not treat it as an
  // extra vote during the 300s DNS TTL overlap or the rollback window.
  const harness = await createVoteGuardHarness();
  try {
    // Simulate the score metadata document already existing in this
    // target's partition (as a pre-cutover backfill or Azure vote would
    // leave behind), with a corroborating Azure-native vote document.
    harness.documents.set("software:cloudflare::score", {
      id: "score",
      doc_type: "score",
      target_id: "software:cloudflare",
      count: 1,
      __partition: "software:cloudflare",
    });
    harness.documents.set("software:cloudflare::github-1", {
      id: "github-1",
      doc_type: "vote",
      target_id: "software:cloudflare",
      user_id: "1",
      created_at: new Date().toISOString(),
      __partition: "software:cloudflare",
    });

    // A late Worker vote from a different viewer during the overlap
    // window must count only the two real votes (the pre-existing Azure
    // one plus this new one) — never the score metadata row.
    const result = await harness.store.setVote("software:cloudflare", "999", true);
    assert.deepEqual(result, { target_id: "software:cloudflare", voted: true, count: 2 });
  } finally {
    harness.restore();
  }
});

test("Cloudflare community store round-trips documents through the master-key REST client", async () => {
  const documents = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    const isQuery = init.headers?.["x-ms-documentdb-isquery"] === "true";
    if (init.method === "POST" && isQuery) {
      const body = JSON.parse(init.body);
      const rows = [...documents.values()].filter((doc) => doc.tool_id === "cloudflare");
      if (body.query.includes("COUNT(1)")) return Response.json({ Documents: [rows.length] });
      return Response.json({ Documents: rows });
    }
    if (init.method === "POST" && parsed.pathname.endsWith("/docs")) {
      const body = JSON.parse(init.body);
      documents.set(body.id, body);
      return Response.json(body, { status: 201 });
    }
    if (init.method === "GET") {
      const id = decodeURIComponent(parsed.pathname.split("/").pop());
      const doc = documents.get(id);
      return doc ? Response.json(doc) : Response.json({ error: "not found" }, { status: 404 });
    }
    if (init.method === "DELETE") {
      const id = decodeURIComponent(parsed.pathname.split("/").pop());
      documents.delete(id);
      return new Response(null, { status: 204 });
    }
    return Response.json({ error: "unsupported" }, { status: 400 });
  };
  try {
    const store = createCloudflareCommunityStore({
      endpoint: "https://yolo-curations-feed.documents.azure.com",
      key: Buffer.from("test-key").toString("base64"),
      database: "curations",
    });
    await store.createDocument("discussions", { id: "thread-1", tool_id: "cloudflare" }, "cloudflare");
    const read = await store.readDocument("discussions", "thread-1", "cloudflare");
    assert.equal(read.id, "thread-1");
    assert.equal(await store.readDocument("discussions", "missing", "cloudflare"), null);

    await store.upsertDocument("discussions", { id: "thread-1", tool_id: "cloudflare", body: "edited" }, "cloudflare");
    assert.equal((await store.readDocument("discussions", "thread-1", "cloudflare")).body, "edited");

    const rows = await store.queryDocuments(
      "discussions",
      "SELECT VALUE COUNT(1) FROM c",
      [],
      "cloudflare",
    );
    assert.deepEqual(rows, [1]);

    await store.deleteDocument("discussions", "thread-1", "cloudflare");
    assert.equal(await store.readDocument("discussions", "thread-1", "cloudflare"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
