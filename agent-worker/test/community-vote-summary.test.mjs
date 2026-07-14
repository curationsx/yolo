import assert from "node:assert/strict";
import test from "node:test";

import { handleVotes } from "../src/community.ts";

class MemoryKv {
  async get() {
    return null;
  }
}

/**
 * `voteSummary` (private to community.ts) must read vote counts through
 * `env.votes.getCounts` whenever the durable vote backend is active,
 * instead of always querying the legacy `scores` container. On Azure the
 * legacy container is never written to by `setVote`'s same-partition
 * transactional batch, so continuing to read it would return stale counts
 * even though the authoritative score metadata document is current.
 */
test("public vote summaries use the durable VoteStore's authoritative counts, not a stale legacy mirror", async () => {
  const STALE_LEGACY_COUNT = 999;
  const CURRENT_AUTHORITATIVE_COUNT = 2;

  const env = {
    RATE: new MemoryKv(),
    VOTE_BACKEND: "durable",
    COSMOS_SCORES_CONTAINER: "scores",
    votes: {
      async getCounts(targetIds) {
        // Authoritative Azure same-partition score metadata.
        return Object.fromEntries(targetIds.map((id) => [id, CURRENT_AUTHORITATIVE_COUNT]));
      },
      async getViewerVotes() {
        return [];
      },
    },
    community: {
      async queryDocuments() {
        // The legacy `scores` container, which the Azure vote store never
        // writes to, is deliberately stale here. If voteSummary ever reads
        // this instead of env.votes.getCounts, the test must fail.
        return [{ target_id: "software:cloudflare", count: STALE_LEGACY_COUNT }];
      },
    },
  };

  const request = new Request("https://api.curations.dev/api/votes?targets=software%3Acloudflare");
  const url = new URL(request.url);
  const response = await handleVotes(request, url, env, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.counts["software:cloudflare"], CURRENT_AUTHORITATIVE_COUNT);
  assert.notEqual(body.counts["software:cloudflare"], STALE_LEGACY_COUNT);
});

test("the legacy kv vote backend is unchanged: it still reads counts from the scores container directly", async () => {
  const LEGACY_COUNT = 7;
  let queried = false;

  const env = {
    RATE: new MemoryKv(),
    VOTE_BACKEND: "kv",
    COSMOS_SCORES_CONTAINER: "scores",
    votes: {
      async getCounts() {
        throw new Error("getCounts must not be called when VOTE_BACKEND is 'kv'");
      },
      async getViewerVotes() {
        throw new Error("getViewerVotes must not be called when VOTE_BACKEND is 'kv'");
      },
    },
    community: {
      async queryDocuments(container, _query, _parameters, partitionKey) {
        queried = true;
        assert.equal(container, "scores");
        assert.equal(partitionKey, "global");
        return [{ target_id: "software:cloudflare", count: LEGACY_COUNT }];
      },
    },
  };

  const request = new Request("https://api.curations.dev/api/votes?targets=software%3Acloudflare");
  const url = new URL(request.url);
  const response = await handleVotes(request, url, env, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.counts["software:cloudflare"], LEGACY_COUNT);
  assert.equal(queried, true);
});
