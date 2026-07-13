/**
 * Azure Cosmos community + vote repository.
 *
 * `createAzureCommunityStore` is a thin, container-name-parameterized CRUD
 * wrapper used for discussions, engagements, and score reads — the same
 * document shapes Cloudflare's master-key REST client already writes, now
 * reached through the managed-identity SDK instead.
 *
 * `createAzureVoteStore` makes the `votes` container the source of truth.
 * Each target's partition holds one document per viewer, `id =
 * "github-<userId>"` — Azure writes `doc_type: "vote"`, but legacy
 * Cloudflare vote documents (`vote-guard.ts`, `{id, target_id, user_id,
 * created_at}`) have no `doc_type` field at all and are equally
 * authoritative — plus exactly one score metadata document (`id = "score"`,
 * `doc_type: "score"`). Because both live in the same partition, a single
 * Cosmos transactional batch adds/removes the vote document and
 * increments/decrements the score document atomically — two viewers can
 * never corrupt the same target's count. Adds and removes are idempotent:
 * voting twice, or unvoting when there is no vote, is a no-op that returns
 * the current state without a network write.
 *
 * `reconcileScoreFromVotes`/`reconcileAllScoresFromVotes` and
 * `reconcileLegacyScoresContainer` rebuild score metadata from the
 * authoritative vote partitions — used before an Azure cutover (seed
 * scores), after an Azure cutover once Cloudflare's DNS TTL has elapsed
 * (absorb votes the legacy Worker wrote late), and before a Cloudflare
 * rollback (rebuild the legacy `scores` container) by the (out-of-scope)
 * ops job.
 */

import type { ItemDefinition } from "@azure/cosmos";
import type { CommunityStore, CosmosQueryParameter, VoteMutationResult, VoteStore } from "../contracts.ts";
import type { CosmosBatchOperation, CosmosContainerLike, CosmosQueryParameterValue } from "./cosmos-types.ts";
import { GatewayErrors } from "./errors.ts";

const MAX_CAS_ATTEMPTS = 8;
const SCORE_DOC_ID = "score";

function cosmosStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") return code;
    if (typeof code === "string" && /^\d+$/.test(code)) return Number(code);
  }
  return undefined;
}

async function jitteredBackoff(attempt: number, baseMs = 8): Promise<void> {
  const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function toCosmosParameters(
  parameters: CosmosQueryParameter[],
): { name: string; value: CosmosQueryParameterValue }[] {
  return parameters.map(({ name, value }) => ({ name, value }));
}

/** Generic document CRUD used for discussions, engagements, and score
 * reads. `containerFor` resolves a container name (e.g.
 * `env.COSMOS_DISCUSSIONS_CONTAINER`) to a live Cosmos container handle. */
export function createAzureCommunityStore(containerFor: (name: string) => CosmosContainerLike): CommunityStore {
  return {
    async createDocument<T extends object>(containerName: string, doc: T, _partitionKey: string): Promise<void> {
      await containerFor(containerName).items.create(doc as ItemDefinition);
    },
    async readDocument<T>(containerName: string, id: string, partitionKey: string): Promise<T | null> {
      const response = await containerFor(containerName).item(id, partitionKey).read();
      return response.statusCode === 404 || !response.resource ? null : (response.resource as T);
    },
    async upsertDocument<T extends object>(containerName: string, doc: T, _partitionKey: string): Promise<void> {
      await containerFor(containerName).items.upsert(doc as ItemDefinition);
    },
    async deleteDocument(containerName: string, id: string, partitionKey: string): Promise<void> {
      try {
        await containerFor(containerName).item(id, partitionKey).delete();
      } catch (error) {
        if (cosmosStatus(error) !== 404) throw error;
      }
    },
    async queryDocuments<T>(
      containerName: string,
      query: string,
      parameters: CosmosQueryParameter[],
      partitionKey: string,
    ): Promise<T[]> {
      const result = await containerFor(containerName)
        .items.query<T>({ query, parameters: toCosmosParameters(parameters) }, { partitionKey })
        .fetchAll();
      return result.resources;
    },
  };
}

interface VoteDoc {
  id: string;
  doc_type: "vote";
  target_id: string;
  user_id: string;
  created_at: string;
}

interface ScoreDoc {
  id: string;
  doc_type: "score";
  target_id: string;
  count: number;
  updated_at: string;
}

function voteDocId(userId: string): string {
  return `github-${userId}`;
}

async function readVoteAndScore(
  container: CosmosContainerLike,
  targetId: string,
  userId: string,
): Promise<{ vote?: VoteDoc; voteEtag?: string; score?: ScoreDoc; scoreEtag?: string }> {
  const [voteRead, scoreRead] = await Promise.all([
    container.item(voteDocId(userId), targetId).read(),
    container.item(SCORE_DOC_ID, targetId).read(),
  ]);
  return {
    vote: voteRead.statusCode === 404 ? undefined : (voteRead.resource as VoteDoc | undefined),
    voteEtag: voteRead.statusCode === 404 ? undefined : voteRead.etag,
    score: scoreRead.statusCode === 404 ? undefined : (scoreRead.resource as ScoreDoc | undefined),
    scoreEtag: scoreRead.statusCode === 404 ? undefined : scoreRead.etag,
  };
}

/** Same-partition Cosmos transactional batch: the vote document and the
 * score document either both commit or neither does. */
export function createAzureVoteStore(container: CosmosContainerLike): VoteStore {
  return {
    async setVote(targetId: string, userId: string, voted: boolean): Promise<VoteMutationResult> {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const { vote, voteEtag, score, scoreEtag } = await readVoteAndScore(container, targetId, userId);
        const currentCount = score?.count ?? 0;

        if (voted && vote) {
          return { target_id: targetId, voted: true, count: currentCount };
        }
        if (!voted && !vote) {
          return { target_id: targetId, voted: false, count: currentCount };
        }

        const now = new Date().toISOString();
        const nextCount = voted ? currentCount + 1 : Math.max(0, currentCount - 1);
        const scoreDoc: ScoreDoc = {
          id: SCORE_DOC_ID,
          doc_type: "score",
          target_id: targetId,
          count: nextCount,
          updated_at: now,
        };
        const voteOperation: CosmosBatchOperation = voted
          ? {
              operationType: "Create",
              resourceBody: {
                id: voteDocId(userId),
                doc_type: "vote",
                target_id: targetId,
                user_id: userId,
                created_at: now,
              } as ItemDefinition,
            }
          : { operationType: "Delete", id: voteDocId(userId), ifMatch: voteEtag };
        const scoreOperation: CosmosBatchOperation = score
          ? { operationType: "Replace", id: SCORE_DOC_ID, resourceBody: scoreDoc as ItemDefinition, ifMatch: scoreEtag }
          : { operationType: "Create", resourceBody: scoreDoc as ItemDefinition };

        let response;
        try {
          response = await container.items.batch([voteOperation, scoreOperation], targetId);
        } catch (error) {
          const status = cosmosStatus(error);
          if (status === 429) {
            await jitteredBackoff(attempt);
            continue;
          }
          throw error;
        }

        const results = response.result ?? [];
        const succeeded =
          results.length === 2 && results.every((result) => result.statusCode >= 200 && result.statusCode < 300);
        if (succeeded) {
          return { target_id: targetId, voted, count: nextCount };
        }
        // A conflicting operation (409/412) means another viewer raced us on
        // the same target — re-read and retry.
        await jitteredBackoff(attempt);
      }
      throw GatewayErrors.dependencyThrottled(1, { store: "votes" });
    },

    async getViewerVotes(userId: string, targets: string[]): Promise<string[]> {
      const voted = await Promise.all(
        targets.map(async (targetId) => {
          const response = await container.item(voteDocId(userId), targetId).read();
          return response.statusCode !== 404 && response.resource ? targetId : null;
        }),
      );
      return voted.filter((target): target is string => target !== null);
    },

    async getCounts(targetIds: string[]): Promise<Record<string, number>> {
      // The score metadata document lives in the same partition as its
      // target's vote documents and is what `setVote`'s transactional
      // batch itself updates — reading it here (rather than the legacy
      // `scores` container, which this store never writes to) is what
      // keeps public vote summaries from going stale after an Azure vote.
      const entries = await Promise.all(
        targetIds.map(async (targetId) => {
          const response = await container.item(SCORE_DOC_ID, targetId).read();
          if (response.statusCode === 404 || !response.resource) return null;
          return [targetId, (response.resource as ScoreDoc).count] as const;
        }),
      );
      return Object.fromEntries(entries.filter((entry): entry is readonly [string, number] => entry !== null));
    },
  };
}

/** Rebuilds the score metadata document for one target from its
 * authoritative vote documents. Idempotent: it always recomputes "current
 * vote count now" and writes it, so repeated calls converge to the same
 * result and never double-count, whether this is the first pre-cutover
 * backfill, a post-cutover late-vote absorption pass, or a repeat of
 * either.
 *
 * Counts every document in the partition that isn't the score metadata
 * document itself, not just documents with `doc_type: "vote"`. Legacy
 * Cloudflare vote documents (written by `vote-guard.ts`'s durable path,
 * still reachable during the post-cutover DNS TTL race window) are shaped
 * `{id, target_id, user_id, created_at}` with no `doc_type` field at all —
 * filtering on `doc_type = "vote"` would silently miss exactly the late
 * legacy writes this reconciliation exists to absorb.
 *
 * Uses the same bounded ETag CAS pattern as `setVote`, in this exact
 * order, per attempt: read the score doc (and its ETag) first, then
 * recompute the authoritative vote count, then write conditionally
 * (Replace with `ifMatch` if the doc existed, Create if it did not). A
 * blind `upsert` here would be a lost-update race: if a live `setVote`
 * commits its own score update between this function's count query and
 * its write, a blind upsert would silently overwrite that concurrent
 * result with this call's now-stale count. Reading the ETag before
 * recomputing the count means any such race is instead detected as a
 * 409/412 conflict and retried against fresh state, so the final written
 * count can never regress behind a vote that has already been recorded. */
export async function reconcileScoreFromVotes(
  container: CosmosContainerLike,
  targetId: string,
): Promise<{ target_id: string; count: number }> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    let existingScore: ScoreDoc | undefined;
    let scoreEtag: string | undefined;
    try {
      const read = await container.item(SCORE_DOC_ID, targetId).read();
      if (read.statusCode !== 404 && read.resource) {
        existingScore = read.resource as ScoreDoc;
        scoreEtag = read.etag;
      }
    } catch (error) {
      if (cosmosStatus(error) === 429) {
        await jitteredBackoff(attempt);
        continue;
      }
      throw error;
    }

    const result = await container.items
      .query<number>(
        { query: "SELECT VALUE COUNT(1) FROM c WHERE (NOT IS_DEFINED(c.doc_type) OR c.doc_type = 'vote') AND c.id != 'score'" },
        { partitionKey: targetId },
      )
      .fetchAll();
    const count = result.resources[0] ?? 0;
    const scoreDoc: ScoreDoc = {
      id: SCORE_DOC_ID,
      doc_type: "score",
      target_id: targetId,
      count,
      updated_at: new Date().toISOString(),
    };

    const operation: CosmosBatchOperation = existingScore
      ? { operationType: "Replace", id: SCORE_DOC_ID, resourceBody: scoreDoc as ItemDefinition, ifMatch: scoreEtag }
      : { operationType: "Create", resourceBody: scoreDoc as ItemDefinition };

    let response;
    try {
      response = await container.items.batch([operation], targetId);
    } catch (error) {
      if (cosmosStatus(error) === 429) {
        await jitteredBackoff(attempt);
        continue;
      }
      throw error;
    }

    const results = response.result ?? [];
    const succeeded = results.length === 1 && results[0].statusCode >= 200 && results[0].statusCode < 300;
    if (succeeded) {
      return { target_id: targetId, count };
    }
    // A concurrent setVote (or another reconciliation run) created or
    // replaced the score doc between our read and our write — re-read
    // and recompute against fresh state rather than overwrite it.
    await jitteredBackoff(attempt);
  }
  throw GatewayErrors.dependencyThrottled(1, { store: "reconciliation" });
}

/**
 * Rebuilds the score metadata document for every given target from the
 * authoritative vote documents in the same `votes` container. This one
 * operation serves two distinct points in the cutover timeline described
 * in `.azure/deployment-plan.md`:
 *
 * - **Pre-cutover backfill** — run once, with no timing constraint, before
 *   Azure ever serves traffic, so score metadata reflects every vote that
 *   already exists.
 * - **Post-cutover reconciliation** — Cloudflare's proxied DNS TTL (300s)
 *   means some clients keep resolving `api.curations.dev` to the legacy
 *   Worker for a while after the DNS cutover. The legacy Worker can still
 *   write `votes` (and the legacy `scores` container) during that window
 *   without updating this same-partition score metadata document. Re-run
 *   this same function after waiting at least one old-DNS TTL — 10 minutes
 *   preferred — to absorb those late votes.
 *
 * Idempotent by construction (see `reconcileScoreFromVotes`): every call
 * recomputes "authoritative vote count right now" per target and upserts
 * it, so running this any number of times — including immediately
 * back-to-back, or repeatedly after every subsequent late-vote window —
 * always converges to the same correct count and never double-counts.
 */
export async function reconcileAllScoresFromVotes(
  container: CosmosContainerLike,
  targetIds: string[],
): Promise<{ target_id: string; count: number }[]> {
  const results: { target_id: string; count: number }[] = [];
  for (const targetId of targetIds) {
    results.push(await reconcileScoreFromVotes(container, targetId));
  }
  return results;
}

/** Rebuilds the legacy (Cloudflare rollback) `scores` container from the
 * authoritative Azure vote partitions, one target at a time. */
export async function reconcileLegacyScoresContainer(
  votesContainer: CosmosContainerLike,
  legacyScoresContainer: CosmosContainerLike,
  targetIds: string[],
): Promise<{ target_id: string; count: number }[]> {
  const results: { target_id: string; count: number }[] = [];
  for (const targetId of targetIds) {
    const reconciled = await reconcileScoreFromVotes(votesContainer, targetId);
    await legacyScoresContainer.items.upsert({
      id: targetId,
      scope: "global",
      target_id: targetId,
      count: reconciled.count,
      updated_at: new Date().toISOString(),
    });
    results.push(reconciled);
  }
  return results;
}

