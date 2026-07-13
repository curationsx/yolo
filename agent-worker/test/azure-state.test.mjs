import assert from "node:assert/strict";
import test from "node:test";

import {
  createAzureCopilotGrantStore,
  createAzureKeyValueStore,
  createAzureQuotaStore,
  sha256Hex,
} from "../src/platform/azure/state.ts";
import { isGatewayError } from "../src/platform/azure/errors.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

test("sha256Hex is deterministic and never reveals the input", () => {
  const digest = sha256Hex("super-secret-session-token");
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, sha256Hex("super-secret-session-token"));
  assert.notEqual(digest.includes("super-secret-session-token"), true);
});

test("Azure KV store round-trips string and JSON values with TTL", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureKeyValueStore(container);

  await store.put("plain-key", "plain-value");
  assert.equal(await store.get("plain-key"), "plain-value");

  await store.put("json-key", JSON.stringify({ hello: "world" }), { expirationTtl: 600 });
  assert.deepEqual(await store.get("json-key", "json"), { hello: "world" });

  const stored = container.documents.get(container._key("kv", sha256Hex("kv:json-key")));
  assert.equal(stored.doc.ttl, 600);

  assert.equal(await store.get("missing-key"), null);
});

test("Azure KV store hashes secret-bearing keys into the document id", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureKeyValueStore(container);
  await store.put("session:abcdef", "value");
  const expectedId = sha256Hex("kv:session:abcdef");
  assert.ok(container.documents.has(container._key("kv", expectedId)));
  for (const [, entry] of container.documents) {
    assert.equal(JSON.stringify(entry.doc).includes("abcdef") && entry.doc.id !== expectedId, false);
  }
});

test("Azure KV store delete is idempotent (missing key is not an error)", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureKeyValueStore(container);
  await store.put("key", "value");
  await store.delete("key");
  assert.equal(await store.get("key"), null);
  await store.delete("key"); // second delete of an already-missing key must not throw
});

test("Azure KV store delete rethrows non-404 errors", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureKeyValueStore(container);
  await store.put("key", "value");
  container.failNext("delete", 500);
  await assert.rejects(store.delete("key"));
});

const validGrant = () => ({
  version: 1,
  user_id: "123",
  iv: "A".repeat(16),
  ciphertext: "B".repeat(20),
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
});

test("Azure Copilot grant store consumes a grant exactly once", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  const grant = validGrant();

  await store.put("session-token", grant);
  assert.deepEqual(await store.status("session-token"), { connected: true, expires_at: grant.expires_at });

  const consumed = await store.consume("session-token");
  assert.deepEqual(consumed, grant);

  // A second consumer loses the race — no automatic replay.
  const second = await store.consume("session-token");
  assert.equal(second, null);
  assert.deepEqual(await store.status("session-token"), { connected: false, expires_at: null });
});

test("Azure Copilot grant store treats a concurrent consumer's delete race as a lost race", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", validGrant());

  // Simulate another consumer deleting the grant between our read and our
  // conditional delete (an ETag mismatch surfaces as 412).
  container.failNext("delete", 412);
  const result = await store.consume("session-token");
  assert.equal(result, null);
});

test("Azure Copilot grant store never returns an expired grant", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", { ...validGrant(), expires_at: new Date(Date.now() - 1000).toISOString() });

  assert.deepEqual(await store.status("session-token"), { connected: false, expires_at: null });
  assert.equal(await store.consume("session-token"), null);
});

test("Azure Copilot grant store revoke is idempotent", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", validGrant());
  await store.revoke("session-token");
  await store.revoke("session-token"); // already gone; must not throw
  assert.deepEqual(await store.status("session-token"), { connected: false, expires_at: null });
});

test("Azure Copilot grant store rethrows unexpected read/delete errors", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", validGrant());
  container.failNext("delete", 500);
  await assert.rejects(store.consume("session-token"));

  container.failNext("delete", 500);
  await assert.rejects(store.revoke("session-token"));
});

test("Azure quota store reserves and releases every rule in one all-or-none document", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  const rules = [
    { key: "user:1", limit: 2 },
    { key: "global", limit: 5 },
  ];

  assert.deepEqual(await store.reserve(rules), { allowed: true });
  assert.deepEqual(await store.reserve(rules), { allowed: true });
  // Third reservation exceeds the per-user limit — no rule may be partially
  // consumed when the request is rejected.
  const rejected = await store.reserve(rules);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.blocked_key, "user:1");

  await store.release(rules);
  await store.release(rules);
  assert.deepEqual(await store.reserve(rules), { allowed: true });
});

test("Azure quota store retries once on an ETag conflict and then succeeds", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  await store.reserve([{ key: "user:1", limit: 10 }]);
  container.failNext("replace", 412);
  const result = await store.reserve([{ key: "user:1", limit: 10 }]);
  assert.deepEqual(result, { allowed: true });
});

test("Azure quota store retries on 429 throttling with the server's retry hint", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  container.failNext("read", 429, 1);
  const result = await store.reserve([{ key: "user:1", limit: 10 }]);
  assert.deepEqual(result, { allowed: true });
});

test("Azure quota store returns a typed dependency error when retries are exhausted", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  await store.reserve([{ key: "user:1", limit: 10 }]); // ensure the daily document exists
  for (let i = 0; i < 20; i += 1) container.failNext("replace", 412);
  await assert.rejects(store.reserve([{ key: "user:1", limit: 10 }]), (error) => {
    assert.ok(isGatewayError(error));
    assert.equal(error.code, "dependency_throttled");
    assert.equal(error.status, 503);
    return true;
  });
});

test("Azure Copilot grant store still returns null when best-effort cleanup of an expired grant fails", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", { ...validGrant(), expires_at: new Date(Date.now() - 1000).toISOString() });
  container.failNext("delete", 500);
  const result = await store.consume("session-token");
  assert.equal(result, null);
});

test("Azure quota store retries on 429 during the write phase", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  container.failNext("create", 429);
  const result = await store.reserve([{ key: "user:1", limit: 10 }]);
  assert.deepEqual(result, { allowed: true });

  await store.reserve([{ key: "user:1", limit: 10 }]); // doc now exists
  container.failNext("replace", 429);
  const second = await store.reserve([{ key: "user:1", limit: 10 }]);
  assert.deepEqual(second, { allowed: true });
});

test("cosmosStatus and retryAfterMs fall back safely for errors without a numeric code", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureCopilotGrantStore(container);
  await store.put("session-token", validGrant());
  // An error without a `.code` property at all exercises the safe fallback
  // path (treated as non-404, so it is rethrown rather than swallowed).
  container.failNext("delete", undefined);
  await assert.rejects(store.revoke("session-token"));
});

test("Azure quota store rethrows unexpected errors instead of retrying forever", async () => {
  const container = new FakeCosmosContainer("scope");
  const store = createAzureQuotaStore(container);
  container.failNext("read", 500);
  await assert.rejects(store.reserve([{ key: "user:1", limit: 10 }]));

  await store.reserve([{ key: "user:1", limit: 10 }]); // ensure the daily document exists
  container.failNext("replace", 500);
  await assert.rejects(store.reserve([{ key: "user:1", limit: 10 }]));
});
