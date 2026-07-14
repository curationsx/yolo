import assert from "node:assert/strict";
import test from "node:test";

import { handleVoteSet, handleVoteToggle, handleVotes } from "../src/community.ts";
import { createAzureCommunityStore } from "../src/platform/azure/community.ts";
import { createAzureKeyValueStore, createAzureQuotaStore } from "../src/platform/azure/state.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

/**
 * Staging sequencing: until PR #5 lands the fixed Cloudflare Worker and a
 * metadata backfill, Azure runs with VOTE_BACKEND=kv. In that mode the
 * managed-identity `community` binding (real Cosmos SQL semantics via
 * `createAzureCommunityStore`, not a hand-mocked object) must serve every
 * vote read/write, and the durable `VoteStore` (`env.votes`, the
 * transactional-batch path meant for VOTE_BACKEND=durable) must never be
 * touched. `test/community-vote-summary.test.mjs` already proves the read
 * side (`voteSummary`) with a mocked env.community; this proves the full
 * write path (`handleVoteSet`/`handleVoteToggle`) against the real Azure
 * adapter, which is what actually runs in staging.
 */

function trapVoteStore() {
  const calls = [];
  const trap = (name) => (...args) => {
    calls.push(name);
    throw new Error(`VoteStore.${name} must not be called when VOTE_BACKEND is 'kv' (args: ${JSON.stringify(args)})`);
  };
  return {
    calls,
    store: {
      setVote: trap("setVote"),
      getViewerVotes: trap("getViewerVotes"),
      getCounts: trap("getCounts"),
    },
  };
}

function kvCompatibilityEnv() {
  const votesContainer = new FakeCosmosContainer("target_id");
  const scoresContainer = new FakeCosmosContainer("scope");
  const containerFor = (name) => {
    if (name === "votes") return votesContainer;
    if (name === "scores") return scoresContainer;
    throw new Error(`unexpected container ${name}`);
  };
  const trappedVotes = trapVoteStore();

  const env = {
    VOTE_BACKEND: "kv",
    COSMOS_VOTES_CONTAINER: "votes",
    COSMOS_SCORES_CONTAINER: "scores",
    COSMOS_DISCUSSIONS_CONTAINER: "discussions",
    SOFTWARE_TARGETS: "cloudflare,supabase",
    RATE: createAzureKeyValueStore(new FakeCosmosContainer("scope")),
    quota: createAzureQuotaStore(new FakeCosmosContainer("scope")),
    community: createAzureCommunityStore(containerFor),
    votes: trappedVotes.store,
    requestMetadata: { clientIp: () => "127.0.0.1" },
  };

  return { env, votesContainer, scoresContainer, voteStoreCalls: trappedVotes.calls };
}

async function seedSession(env, token) {
  const session = {
    user: {
      provider: "github",
      id: "kv-curator",
      login: "kv-curator",
      name: "KV Curator",
      avatar_url: "https://avatars.example/kv-curator",
      html_url: "https://github.com/kv-curator",
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  await env.RATE.put(`session:${token}`, JSON.stringify(session));
}

function authedRequest(url, token, body) {
  return new Request(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "https://curations.dev",
    },
    body: JSON.stringify(body),
  });
}

test("VOTE_BACKEND=kv drives the full vote set/toggle/summary flow through the real managed-identity community binding, never the durable VoteStore", async () => {
  const token = "T".repeat(48);
  const { env, scoresContainer, voteStoreCalls } = kvCompatibilityEnv();
  await seedSession(env, token);

  const set = await handleVoteSet(
    authedRequest("https://api.curations.dev/api/votes/set", token, {
      target_id: "software:cloudflare",
      voted: true,
    }),
    env,
    {},
  );
  assert.equal(set.status, 200);
  assert.deepEqual(await set.json(), {
    target_id: "software:cloudflare",
    voted: true,
    count: 1,
  });

  // Re-voting the same target is idempotent — no double count.
  const setAgain = await handleVoteSet(
    authedRequest("https://api.curations.dev/api/votes/set", token, {
      target_id: "software:cloudflare",
      voted: true,
    }),
    env,
    {},
  );
  assert.deepEqual(await setAgain.json(), {
    target_id: "software:cloudflare",
    voted: true,
    count: 1,
  });

  const summaryRequest = new Request(
    "https://api.curations.dev/api/votes?targets=software%3Acloudflare",
    { headers: { authorization: `Bearer ${token}` } },
  );
  const summaryResponse = await handleVotes(
    summaryRequest,
    new URL(summaryRequest.url),
    env,
    {},
  );
  const summary = await summaryResponse.json();
  assert.equal(summary.counts["software:cloudflare"], 1);
  assert.deepEqual(summary.viewer_votes, ["software:cloudflare"]);

  // The legacy scores container (managed-identity binding) is the one
  // actually updated in kv mode — prove it round-tripped through Cosmos,
  // not an in-memory shortcut.
  const scoreDoc = await scoresContainer.item("software:cloudflare", "global").read();
  assert.equal(scoreDoc.resource.count, 1);

  const toggleOff = await handleVoteToggle(
    authedRequest("https://api.curations.dev/api/votes/toggle", token, {
      target_id: "software:cloudflare",
    }),
    env,
    {},
  );
  assert.deepEqual(await toggleOff.json(), {
    target_id: "software:cloudflare",
    voted: false,
    count: 0,
  });

  const afterToggle = await scoresContainer.item("software:cloudflare", "global").read();
  assert.equal(afterToggle.resource.count, 0);

  assert.deepEqual(voteStoreCalls, [], "durable VoteStore must never be invoked in kv mode");
});
