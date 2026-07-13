import assert from "node:assert/strict";
import test from "node:test";

import {
  createAzureCommunityStore,
  createAzureVoteStore,
  reconcileAllScoresFromVotes,
  reconcileLegacyScoresContainer,
  reconcileScoreFromVotes,
} from "../src/platform/azure/community.ts";
import { isGatewayError } from "../src/platform/azure/errors.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

function communityStore() {
  const containers = new Map();
  const containerFor = (name) => {
    let container = containers.get(name);
    if (!container) {
      // The discussions/engagements containers are partitioned by tool_id.
      container = new FakeCosmosContainer("tool_id");
      containers.set(name, container);
    }
    return container;
  };
  return { containerFor, containers };
}

test("Azure community store creates, reads, upserts, deletes, and queries documents", async () => {
  const { containerFor } = communityStore();
  const store = createAzureCommunityStore(containerFor);

  await store.createDocument("discussions", { id: "thread-1", tool_id: "cloudflare", body: "hi" }, "cloudflare");
  const read = await store.readDocument("discussions", "thread-1", "cloudflare");
  assert.equal(read.body, "hi");

  await store.upsertDocument("discussions", { id: "thread-1", tool_id: "cloudflare", body: "edited" }, "cloudflare");
  const updated = await store.readDocument("discussions", "thread-1", "cloudflare");
  assert.equal(updated.body, "edited");

  await store.deleteDocument("discussions", "thread-1", "cloudflare");
  assert.equal(await store.readDocument("discussions", "thread-1", "cloudflare"), null);

  // Deleting again (already gone) must not throw.
  await store.deleteDocument("discussions", "thread-1", "cloudflare");
});

test("Azure community store readDocument returns null for a missing document", async () => {
  const { containerFor } = communityStore();
  const store = createAzureCommunityStore(containerFor);
  assert.equal(await store.readDocument("discussions", "missing", "cloudflare"), null);
});

test("Azure community store deleteDocument rethrows unexpected errors", async () => {
  const { containerFor, containers } = communityStore();
  const store = createAzureCommunityStore(containerFor);
  await store.createDocument("discussions", { id: "thread-1", tool_id: "cloudflare" }, "cloudflare");
  containers.get("discussions").failNext("delete", 500);
  await assert.rejects(store.deleteDocument("discussions", "thread-1", "cloudflare"));
});

test("Azure community store deleteDocument rethrows errors without a numeric code", async () => {
  const { containerFor, containers } = communityStore();
  const store = createAzureCommunityStore(containerFor);
  await store.createDocument("discussions", { id: "thread-1", tool_id: "cloudflare" }, "cloudflare");
  containers.get("discussions").failNext("delete", undefined);
  await assert.rejects(store.deleteDocument("discussions", "thread-1", "cloudflare"));
});

test("Azure community store queries documents scoped to their container and partition", async () => {
  const { containerFor } = communityStore();
  const store = createAzureCommunityStore(containerFor);
  await store.createDocument("discussions", { id: "t1", tool_id: "cloudflare", kind: "thread" }, "cloudflare");
  await store.createDocument("discussions", { id: "t2", tool_id: "supabase", kind: "thread" }, "supabase");
  const results = await store.queryDocuments(
    "discussions",
    "SELECT VALUE COUNT(1) FROM c WHERE c.kind = @kind",
    [{ name: "@kind", value: "thread" }],
    "cloudflare",
  );
  assert.deepEqual(results, [1]);
});

test("Azure vote store add is idempotent and increments the same-partition score once", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);

  const first = await store.setVote("software:cloudflare", "123", true);
  assert.deepEqual(first, { target_id: "software:cloudflare", voted: true, count: 1 });

  // Voting again while already voted is a no-op — no double count.
  const second = await store.setVote("software:cloudflare", "123", true);
  assert.deepEqual(second, { target_id: "software:cloudflare", voted: true, count: 1 });

  assert.deepEqual(await store.getViewerVotes("123", ["software:cloudflare"]), ["software:cloudflare"]);
});

test("Azure vote store remove is idempotent and decrements only once", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "123", true);

  const removed = await store.setVote("software:cloudflare", "123", false);
  assert.deepEqual(removed, { target_id: "software:cloudflare", voted: false, count: 0 });

  // Removing again when there is no vote is a no-op.
  const removedAgain = await store.setVote("software:cloudflare", "123", false);
  assert.deepEqual(removedAgain, { target_id: "software:cloudflare", voted: false, count: 0 });
});

test("Azure vote store keeps two viewers' counts correct on the same target", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:cloudflare", "2", true);
  const summary = await store.setVote("software:cloudflare", "1", true); // idempotent re-vote
  assert.equal(summary.count, 2);
  assert.deepEqual(
    (await store.getViewerVotes("2", ["software:cloudflare"])),
    ["software:cloudflare"],
  );
});

test("Azure vote store retries the transactional batch once when a concurrent write conflicts", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  votesContainer.failNext("batch", 429);
  const result = await store.setVote("software:cloudflare", "123", true);
  assert.deepEqual(result, { target_id: "software:cloudflare", voted: true, count: 1 });
});

test("Azure vote store surfaces a typed dependency error when the batch keeps conflicting", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  for (let i = 0; i < 10; i += 1) votesContainer.failNext("batch", "conflict");
  await assert.rejects(store.setVote("software:cloudflare", "999", true), (error) => {
    assert.ok(isGatewayError(error));
    assert.equal(error.code, "dependency_throttled");
    return true;
  });
});

test("Azure vote store rethrows unexpected batch errors", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  votesContainer.failNext("batch", 500);
  await assert.rejects(store.setVote("software:cloudflare", "123", true));
});

test("getViewerVotes returns an empty list for targets with no vote", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  assert.deepEqual(await store.getViewerVotes("123", ["software:cloudflare", "software:supabase"]), []);
});

test("getCounts reads the same-partition score metadata setVote writes, never the legacy scores container", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:cloudflare", "2", true);
  await store.setVote("software:supabase", "1", true);

  const counts = await store.getCounts(["software:cloudflare", "software:supabase", "software:never-voted"]);
  assert.deepEqual(counts, { "software:cloudflare": 2, "software:supabase": 1 });
});

test("getCounts reflects a vote immediately, proving it never depends on the legacy scores container", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  assert.deepEqual(await store.getCounts(["software:cloudflare"]), {});

  await store.setVote("software:cloudflare", "1", true);
  assert.deepEqual(await store.getCounts(["software:cloudflare"]), { "software:cloudflare": 1 });

  await store.setVote("software:cloudflare", "1", false);
  assert.deepEqual(await store.getCounts(["software:cloudflare"]), { "software:cloudflare": 0 });
});

test("reconcileScoreFromVotes rebuilds the score document from vote documents", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:cloudflare", "2", true);

  // Corrupt the score doc to prove reconciliation recomputes it from votes.
  await votesContainer.items.upsert({ id: "score", doc_type: "score", target_id: "software:cloudflare", count: 999 });

  const reconciled = await reconcileScoreFromVotes(votesContainer, "software:cloudflare");
  assert.deepEqual(reconciled, { target_id: "software:cloudflare", count: 2 });
});

test("reconcileScoreFromVotes reports zero for a target with no vote documents", async () => {
  const votesContainer = new FakeCosmosContainer();
  const reconciled = await reconcileScoreFromVotes(votesContainer, "software:never-voted");
  assert.deepEqual(reconciled, { target_id: "software:never-voted", count: 0 });
});

test("reconcileScoreFromVotes counts legacy (no doc_type) and Azure-native vote docs together, excluding the score doc", async () => {
  const votesContainer = new FakeCosmosContainer();
  // True legacy Cloudflare shape — no doc_type field (vote-guard.ts:237-243).
  await votesContainer.items.upsert({
    id: "github-1",
    target_id: "software:cloudflare",
    user_id: "1",
    created_at: new Date().toISOString(),
  });
  // Azure-native shape.
  await votesContainer.items.upsert({
    id: "github-2",
    doc_type: "vote",
    target_id: "software:cloudflare",
    user_id: "2",
    created_at: new Date().toISOString(),
  });
  // The score metadata document itself must never be counted as a vote.
  await votesContainer.items.upsert({
    id: "score",
    doc_type: "score",
    target_id: "software:cloudflare",
    count: 0,
  });

  const reconciled = await reconcileScoreFromVotes(votesContainer, "software:cloudflare");
  assert.deepEqual(reconciled, { target_id: "software:cloudflare", count: 2 });
});

test("reconcileAllScoresFromVotes backfills every target's score metadata in one pass", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:cloudflare", "2", true);
  await store.setVote("software:supabase", "1", true);

  const results = await reconcileAllScoresFromVotes(votesContainer, [
    "software:cloudflare",
    "software:supabase",
    "software:never-voted",
  ]);
  assert.deepEqual(results, [
    { target_id: "software:cloudflare", count: 2 },
    { target_id: "software:supabase", count: 1 },
    { target_id: "software:never-voted", count: 0 },
  ]);
});

test("reconcileAllScoresFromVotes is idempotent — repeated runs converge without double-counting", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:cloudflare", "2", true);

  const first = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  const second = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  const third = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  assert.deepEqual(first, [{ target_id: "software:cloudflare", count: 2 }]);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("reconcileAllScoresFromVotes absorbs true legacy-shaped Cloudflare vote docs (no doc_type) written late during the DNS TTL race window", async () => {
  const votesContainer = new FakeCosmosContainer();
  const store = createAzureVoteStore(votesContainer);

  // Pre-cutover backfill: no votes yet.
  const preCutover = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  assert.deepEqual(preCutover, [{ target_id: "software:cloudflare", count: 0 }]);

  // Cutover happens. During Cloudflare's proxied DNS TTL window, some
  // clients still resolve to the legacy Worker, which writes a vote
  // document directly through vote-guard.ts's durable path (see
  // vote-guard.ts:237-243): `{id, target_id, user_id, created_at}` with NO
  // `doc_type` field at all — it never updates this same-partition score
  // metadata document. Simulated here with a true legacy-shaped document
  // (not the Azure-native `doc_type: "vote"` shape).
  await votesContainer.items.upsert({
    id: "github-999",
    target_id: "software:cloudflare",
    user_id: "999",
    created_at: new Date().toISOString(),
  });

  // Immediately after cutover, Azure's own score metadata is still stale —
  // it does not yet reflect the legacy Worker's late write.
  const staleRead = await votesContainer.item("score", "software:cloudflare").read();
  assert.equal(staleRead.resource.count, 0);

  // After waiting at least one old-DNS TTL (10 minutes preferred), the
  // post-cutover reconciliation run absorbs the late legacy-shaped vote —
  // proving the count query no longer relies on `doc_type` being present.
  const postCutover = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  assert.deepEqual(postCutover, [{ target_id: "software:cloudflare", count: 1 }]);

  // A normal Azure-side vote also still commits correctly afterward, and
  // re-running the reconciliation again stays idempotent.
  await store.setVote("software:cloudflare", "1", true);
  const again = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  assert.deepEqual(again, [{ target_id: "software:cloudflare", count: 2 }]);
  const repeat = await reconcileAllScoresFromVotes(votesContainer, ["software:cloudflare"]);
  assert.deepEqual(repeat, again);
});

test("reconcileLegacyScoresContainer rebuilds the legacy scores container for every target", async () => {
  const votesContainer = new FakeCosmosContainer();
  const legacyScoresContainer = new FakeCosmosContainer("scope");
  const store = createAzureVoteStore(votesContainer);
  await store.setVote("software:cloudflare", "1", true);
  await store.setVote("software:supabase", "1", true);
  await store.setVote("software:supabase", "2", true);

  const results = await reconcileLegacyScoresContainer(votesContainer, legacyScoresContainer, [
    "software:cloudflare",
    "software:supabase",
  ]);
  assert.deepEqual(results, [
    { target_id: "software:cloudflare", count: 1 },
    { target_id: "software:supabase", count: 2 },
  ]);

  const legacyCloudflare = await legacyScoresContainer.item("software:cloudflare", "global").read();
  assert.equal(legacyCloudflare.resource.count, 1);
  const legacySupabase = await legacyScoresContainer.item("software:supabase", "global").read();
  assert.equal(legacySupabase.resource.count, 2);
});
