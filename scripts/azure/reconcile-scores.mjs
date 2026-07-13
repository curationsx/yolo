#!/usr/bin/env node
// scripts/azure/reconcile-scores.mjs
//
// Implements the approved reconciliation path from .azure/deployment-plan.md
// ("Azure State Model" / caj-yolo-ops). The `votes` container is always the
// authoritative source of truth; this tool rebuilds a target mirror's
// per-partition counts from it. There are TWO DISTINCT MIRRORS, never
// interchangeable, each tied to a specific phase via the required
// `--mode` flag:
//
//   --mode backfill       Pre-cutover backfill (no timing gate). Writes the
//                          SAME-PARTITION Azure score metadata document --
//                          `{id: "score", doc_type: "score", target_id,
//                          count, updated_at}` -- living in the `votes`
//                          container itself, partitioned by `target_id`
//                          (see agent-worker/src/platform/azure/
//                          community.ts's ScoreDoc/reconcileScoreFromVotes).
//   --mode post-cutover    Post-cutover reconciliation. Writes the SAME
//                          same-partition Azure score metadata mirror as
//                          --mode backfill (it is the same read/write
//                          target -- just re-run after the DNS TTL race
//                          window has closed to absorb late legacy votes).
//                          This is the ONLY mode with a timing gate: with
//                          --apply, --cutover-manifest <path> (or --since
//                          <iso-timestamp>) is REQUIRED, and the tool
//                          refuses to write until at least
//                          --min-wait-seconds (default 600s -- one old-DNS
//                          TTL, never less than 10 minutes) has elapsed
//                          since the cutover's recorded `cut-api` step.
//                          Dry run is never gated by this.
//   --mode pre-rollback    Pre-rollback reconciliation (no timing gate).
//                          Writes the SEPARATE legacy `scores` container --
//                          `{id: target_id, scope: "global", target_id,
//                          count, updated_at}`, partitioned by the single
//                          `scope: "global"` value (see agent-worker/src/
//                          community.ts's ScoreDoc,
//                          agent-worker/src/vote-guard.ts, and
//                          reconcileLegacyScoresContainer) -- so
//                          Cloudflare's compatibility store is correct
//                          again before falling back.
//
// --cutover-manifest/--since/--min-wait-seconds are only meaningful for
// --mode post-cutover; supplying them with --mode backfill or
// --mode pre-rollback is a hard error (those phases are never time-gated).
//
// Vote counting (shared by all three modes): the authoritative `votes`
// container query counts BOTH legacy Cloudflare-Worker-written vote
// documents -- shaped `{id, target_id, user_id, created_at}` with NO
// `doc_type` field at all (agent-worker/src/vote-guard.ts:237-243) -- and
// Azure-native vote documents (`doc_type: "vote"`,
// agent-worker/src/platform/azure/community.ts), excluding the
// same-partition score metadata document (`id: "score"`). Filtering on
// `doc_type = 'vote'` alone would silently miss exactly the late legacy
// writes reconciliation exists to absorb during the post-cutover DNS TTL
// race window. There is no stored "direction" in the real schema -- a
// vote document's mere existence is the vote (no downvote concept) -- so
// every match contributes +1.
//
// The reconciliation itself is idempotent by construction: it always
// computes "authoritative count now vs. mirror count now" and writes only
// the corrected value (an upsert), so running it any number of times in a
// row -- including immediately back-to-back after absorbing late votes --
// converges to the same result and never double-counts.
//
// Dry run is the default: the tool always computes and reports the full
// diff between authoritative vote counts and the target mirror, and only
// writes changes when both --apply and --confirm reconcile-scores are
// passed. This mirrors bootstrap.sh/cutover.mjs's confirmation-gate design
// so a single flag can never trigger a production write by accident.
//
// Two operating modes ("store", distinct from the required --mode phase
// selector above):
//   --fixture <path>   Offline/test mode: reads a local JSON fixture
//                       describing vote partitions and the target mirror
//                       (whichever of the two real mirrors --mode selects
//                       -- structurally identical from this tool's own
//                       abstracted point of view, just a list of
//                       {target, count}), computes the diff, and (with
//                       --apply) writes the reconciled result back to a
//                       local output file. Never touches real Azure. This
//                       is the store used by scripts/azure/test/** and by
//                       this task, which forbids real production mutation.
//   (no --fixture)     Real mode: connects to the existing Cosmos account
//                       via managed identity using @azure/identity +
//                       @azure/cosmos. These packages are an intentional
//                       *optional* dependency -- they are only imported
//                       when this store actually runs, so scripts/azure
//                       has no install requirement for dry-run/fixture
//                       use. Install them (`npm install @azure/cosmos
//                       @azure/identity` in the ops job's own package)
//                       before using this store for real.
//
// Usage:
//   node scripts/azure/reconcile-scores.mjs --mode backfill --fixture path/to/fixture.json [--apply --confirm reconcile-scores] [--json]
//   node scripts/azure/reconcile-scores.mjs --mode post-cutover --fixture path/to/fixture.json \
//     --cutover-manifest path/to/cutover-manifest.json \
//     [--min-wait-seconds 600] [--apply --confirm reconcile-scores] [--json]
//   node scripts/azure/reconcile-scores.mjs --mode pre-rollback --cosmos-endpoint <uri> --database curations \
//     --votes-container votes --scores-container scores \
//     [--apply --confirm reconcile-scores] [--json]
import fs from "node:fs";
import { parseArgs, CliArgError } from "./lib/cli-args.mjs";

const CONFIRM_PHRASE = "reconcile-scores";

// Cloudflare's current proxied DNS TTL for api.curations.dev. After the
// cut-api DNS change, resolvers/clients can keep resolving to the legacy
// Worker for up to this long.
export const CLOUDFLARE_DNS_TTL_SECONDS = 300;

// Minimum wait before a post-cutover --apply is allowed: at least one full
// old-DNS TTL, and never less than 10 minutes per explicit preference.
export const DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS = Math.max(CLOUDFLARE_DNS_TTL_SECONDS, 600);

// The three procedural phases from .azure/deployment-plan.md. Each phase
// determines which of the two real mirrors this tool reads/writes -- see
// the module header above. This selector is required (no default) so a
// caller can never accidentally reconcile the wrong store.
export const RECONCILE_MODES = ["backfill", "post-cutover", "pre-rollback"];

const ARG_SPEC = {
  mode: { type: "string", default: "" },
  fixture: { type: "string", default: "" },
  "fixture-out": { type: "string", default: "" },
  "cosmos-endpoint": { type: "string", default: "" },
  database: { type: "string", default: "curations" },
  "votes-container": { type: "string", default: "votes" },
  "scores-container": { type: "string", default: "scores" },
  target: { type: "string", default: "" },
  "cutover-manifest": { type: "string", default: "" },
  since: { type: "string", default: "" },
  "min-wait-seconds": { type: "string", default: String(DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS) },
  apply: { type: "boolean", default: false },
  confirm: { type: "string", default: "" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
};

function usage() {
  return `Usage: node scripts/azure/reconcile-scores.mjs --mode ${RECONCILE_MODES.join("|")} --fixture <path> [--apply --confirm ${CONFIRM_PHRASE}] [--json]
       node scripts/azure/reconcile-scores.mjs --mode post-cutover --fixture <path> --cutover-manifest <path>
                        [--min-wait-seconds ${DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS}] [--apply --confirm ${CONFIRM_PHRASE}] [--json]
       node scripts/azure/reconcile-scores.mjs --mode ${RECONCILE_MODES.join("|")} --cosmos-endpoint <uri> [--database curations]
                        [--votes-container votes] [--scores-container scores]
                        [--target <scope>] [--apply --confirm ${CONFIRM_PHRASE}] [--json]

--mode is REQUIRED and selects which of the two real mirrors this tool
reconciles: 'backfill'/'post-cutover' both target the same-partition Azure
score metadata document inside the 'votes' container itself; 'pre-rollback'
targets the separate legacy 'scores' container. See this file's header
comment for the exact persisted document shapes.

Rebuilds the selected mirror's score counts from authoritative vote
partitions. Dry run by default; requires both --apply and --confirm
${CONFIRM_PHRASE} to write. Idempotent: safe to re-run any number of times,
including to absorb votes written late by the legacy Cloudflare Worker
during the DNS TTL race window.

--cutover-manifest/--since/--min-wait-seconds are ONLY valid with
--mode post-cutover (the only phase with a timing gate); supplying them
with another --mode is an error. With --mode post-cutover and --apply, one
of --cutover-manifest or --since is REQUIRED, and --apply refuses to write
until --min-wait-seconds (default ${DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS}) have elapsed since cut-api.`;
}

export class ReconcileConfirmError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReconcileConfirmError";
  }
}

export class PostCutoverWaitError extends Error {
  constructor(message) {
    super(message);
    this.name = "PostCutoverWaitError";
  }
}

export class InvalidModeError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidModeError";
  }
}

/** Throws InvalidModeError unless `mode` is one of RECONCILE_MODES. */
export function validateMode(mode) {
  if (!RECONCILE_MODES.includes(mode)) {
    throw new InvalidModeError(
      `--mode is required and must be one of: ${RECONCILE_MODES.join(", ")} (got '${mode || "<empty>"}')`
    );
  }
}

/**
 * Pure diff computation: given authoritative vote documents (one per
 * viewer, grouped by target) and a target mirror's current counts, returns
 * the set of documents that must be created/updated to match reality.
 * @param {Array<{ target: string, viewerId: string, direction: 1|-1 }>} votes
 * @param {Array<{ target: string, count: number }>} mirrorScores
 * @param {string} [onlyTarget]
 */
export function computeReconciliation(votes, mirrorScores, onlyTarget) {
  const authoritative = new Map();
  for (const vote of votes) {
    if (onlyTarget && vote.target !== onlyTarget) continue;
    const current = authoritative.get(vote.target) || 0;
    authoritative.set(vote.target, current + (vote.direction >= 0 ? 1 : -1));
  }
  const mirrorByTarget = new Map(mirrorScores.map((s) => [s.target, s.count]));

  const allTargets = new Set([...authoritative.keys(), ...mirrorByTarget.keys()]);
  const diffs = [];
  for (const target of allTargets) {
    if (onlyTarget && target !== onlyTarget) continue;
    const authoritativeCount = authoritative.get(target) ?? 0;
    const legacyCount = mirrorByTarget.get(target) ?? 0;
    if (authoritativeCount !== legacyCount) {
      diffs.push({ target, legacyCount, authoritativeCount, delta: authoritativeCount - legacyCount });
    }
  }
  diffs.sort((a, b) => a.target.localeCompare(b.target));
  return diffs;
}

/**
 * Reads the `cut-api` step's recorded timestamp from a cutover.mjs rollback
 * manifest, so a post-cutover reconciliation run can gate its --apply on
 * "at least one old-DNS TTL has elapsed since the API was cut."
 */
export function resolveCutApiTimestamp(cutoverManifestPath) {
  if (!fs.existsSync(cutoverManifestPath)) {
    throw new Error(`Cutover manifest not found: ${cutoverManifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(cutoverManifestPath, "utf8"));
  const step = Array.isArray(manifest.steps) ? manifest.steps.find((s) => s.name === "cut-api") : null;
  if (!step || !step.appliedAt) {
    throw new Error(
      `Cutover manifest ${cutoverManifestPath} has no recorded 'cut-api' step; cannot determine the post-cutover wait window.`
    );
  }
  return step.appliedAt;
}

/**
 * Checks whether at least `minWaitSeconds` have elapsed since `referenceIso`.
 * `nowFn` is injectable so tests never depend on real wall-clock waiting.
 */
export function checkMinimumWaitElapsed(referenceIso, minWaitSeconds, nowFn = () => new Date()) {
  const referenceMs = new Date(referenceIso).getTime();
  if (Number.isNaN(referenceMs)) {
    throw new Error(`Invalid reference timestamp: ${referenceIso}`);
  }
  const elapsedSeconds = (nowFn().getTime() - referenceMs) / 1000;
  return { ok: elapsedSeconds >= minWaitSeconds, elapsedSeconds, requiredSeconds: minWaitSeconds };
}

async function runFixtureMode(values) {
  if (!fs.existsSync(values.fixture)) {
    throw new Error(`Fixture file not found: ${values.fixture}`);
  }
  const fixture = JSON.parse(fs.readFileSync(values.fixture, "utf8"));
  const votes = fixture.votes || [];
  const mirrorScores = fixture.scores || [];
  const diffs = computeReconciliation(votes, mirrorScores, values.target || undefined);

  const report = {
    store: "fixture",
    mode: values.mode,
    source: values.fixture,
    dryRun: !values.apply,
    diffCount: diffs.length,
    diffs,
  };

  if (values.apply) {
    if (values.confirm !== CONFIRM_PHRASE) {
      throw new ReconcileConfirmError(
        `Refusing to apply: --confirm must exactly equal '${CONFIRM_PHRASE}' (got '${values.confirm || "<empty>"}')`
      );
    }
    const reconciled = new Map(mirrorScores.map((s) => [s.target, s.count]));
    for (const diff of diffs) {
      reconciled.set(diff.target, diff.authoritativeCount);
    }
    const outScores = Array.from(reconciled.entries()).map(([target, count]) => ({ target, count }));
    const outPath = values["fixture-out"] || `${values.fixture}.reconciled.json`;
    fs.writeFileSync(outPath, JSON.stringify({ scores: outScores }, null, 2));
    report.applied = true;
    report.outputPath = outPath;
  } else {
    report.applied = false;
  }
  return report;
}

/**
 * Fetches authoritative votes from a real (or fake, test-injected)
 * `votes` container. Counts BOTH legacy Cloudflare-Worker-written vote
 * documents -- shaped `{id, target_id, user_id, created_at}` with no
 * `doc_type` field at all (agent-worker/src/vote-guard.ts:237-243) -- and
 * Azure-native vote documents (`doc_type: "vote"`,
 * agent-worker/src/platform/azure/community.ts), while excluding the
 * same-partition score metadata document (`id: "score"`,
 * `doc_type: "score"`). Filtering on `doc_type = 'vote'` alone would
 * silently miss exactly the late legacy writes this reconciliation exists
 * to absorb during the post-cutover DNS TTL race window. There is no
 * stored "direction" in the real schema -- a vote document's mere
 * existence is the vote (no downvote concept) -- so every match
 * contributes +1; `direction` below is purely this tool's own internal
 * diff-computation representation, never a persisted field.
 */
export async function fetchVotesFromContainer(votesContainer) {
  const { resources } = await votesContainer.items
    .query({
      query:
        "SELECT c.target_id AS target, c.user_id AS viewerId FROM c " +
        "WHERE (NOT IS_DEFINED(c.doc_type) OR c.doc_type = @voteType) AND c.id != @scoreId",
      parameters: [
        { name: "@voteType", value: "vote" },
        { name: "@scoreId", value: "score" },
      ],
    })
    .fetchAll();
  return resources.map((resource) => ({ target: resource.target, viewerId: resource.viewerId, direction: 1 }));
}

/**
 * Fetches the same-partition Azure score metadata mirror from the `votes`
 * container itself -- the mirror `--mode backfill`/`--mode post-cutover`
 * reconcile against (agent-worker/src/platform/azure/community.ts's
 * `ScoreDoc`/`reconcileScoreFromVotes`: `{id: "score", doc_type: "score",
 * target_id, count, updated_at}`, one per target's own partition). This is
 * a DIFFERENT container role than `fetchLegacyScoresFromContainer` below,
 * even though both are invoked with a container argument named similarly
 * by callers -- never conflate the two.
 */
export async function fetchAzureScoreMetadataFromContainer(votesContainer) {
  const { resources } = await votesContainer.items
    .query({
      query: "SELECT c.target_id AS target, c.count FROM c WHERE c.id = @scoreId AND c.doc_type = @scoreType",
      parameters: [
        { name: "@scoreId", value: "score" },
        { name: "@scoreType", value: "score" },
      ],
    })
    .fetchAll();
  return resources;
}

/**
 * Writes the same-partition Azure score metadata mirror back into the
 * `votes` container for `--mode backfill`/`--mode post-cutover`. Document
 * shape and partition key MUST match the real shape exactly
 * (agent-worker/src/platform/azure/community.ts's `ScoreDoc`/
 * `reconcileScoreFromVotes`): `id: "score"`, `doc_type: "score"`,
 * `target_id`, `count`, `updated_at`, partitioned by `target_id` (NOT
 * `scope: "global"` -- that partition key belongs only to the separate
 * legacy scores container written by `writeLegacyScores` below).
 */
export async function writeAzureScoreMetadata(votesContainer, diffs) {
  for (const diff of diffs) {
    // One point write per corrected target; bounded, sequential, and
    // idempotent (re-running converges on the same authoritative count,
    // whether it's the first backfill, a post-cutover late-vote
    // absorption pass, or a repeat of either).
    await votesContainer.items.upsert(
      {
        id: "score",
        doc_type: "score",
        target_id: diff.target,
        count: diff.authoritativeCount,
        updated_at: new Date().toISOString(),
      },
      { partitionKey: diff.target }
    );
  }
}

/**
 * Fetches the legacy (Cloudflare rollback) `scores` mirror from a real (or
 * fake, test-injected) `scores` container -- the mirror `--mode
 * pre-rollback` reconciles against. Legacy/score-mirror documents use
 * `target_id`, not `target` (agent-worker/src/community.ts's `ScoreDoc`).
 */
export async function fetchLegacyScoresFromContainer(scoresContainer) {
  const { resources } = await scoresContainer.items.query("SELECT c.target_id AS target, c.count FROM c").fetchAll();
  return resources;
}

/**
 * Writes reconciled counts back to the legacy `scores` container for
 * `--mode pre-rollback`. Document shape and partition key MUST match the
 * real legacy scores container exactly (agent-worker/src/community.ts's
 * `ScoreDoc`; identical shape written by
 * agent-worker/src/vote-guard.ts:272-280 and by
 * agent-worker/src/platform/azure/community.ts's
 * `reconcileLegacyScoresContainer`): `id` is the target id itself,
 * `scope: "global"` is the (only) partition key value the container uses,
 * `target_id` duplicates `id` as a queryable field, and `updated_at` is a
 * plain ISO timestamp. Omitting `scope`/`target_id` would write a document
 * the SDK cannot partition correctly and that the rest of the codebase can
 * never read back -- this is the exact shape `fetchLegacyScoresFromContainer`
 * reads above, so a repeat reconciliation run converges instead of
 * drifting.
 */
export async function writeLegacyScores(scoresContainer, diffs) {
  for (const diff of diffs) {
    // One point write per corrected target; bounded, sequential, and
    // idempotent (re-running converges on the same authoritative count).
    await scoresContainer.items.upsert(
      {
        id: diff.target,
        scope: "global",
        target_id: diff.target,
        count: diff.authoritativeCount,
        updated_at: new Date().toISOString(),
      },
      { partitionKey: "global" }
    );
  }
}

/**
 * Runs the full query -> diff -> optional-write reconciliation against
 * already-constructed Cosmos container handles -- real Cosmos containers
 * in production, or a lightweight fake in tests -- so this exact logic
 * (including the doc_type/legacy-absorption predicate and the two
 * distinct mirror shapes above) is exercised without requiring a live
 * Cosmos account or the optional `@azure/cosmos` dependency to be
 * installed.
 *
 * `votesContainer` is always the authoritative `votes` container.
 * `targetContainer` is mode-dependent: for `backfill`/`post-cutover` it
 * MUST be the SAME `votes` container handle (the mirror lives in the same
 * partition); for `pre-rollback` it MUST be the separate legacy `scores`
 * container handle. Passing the wrong one silently reconciles against the
 * wrong mirror, so `mode` is required and validated up front.
 */
export async function reconcileFromContainers(votesContainer, targetContainer, { mode, target, apply } = {}) {
  validateMode(mode);
  const votes = await fetchVotesFromContainer(votesContainer);
  const mirrorScores =
    mode === "pre-rollback"
      ? await fetchLegacyScoresFromContainer(targetContainer)
      : await fetchAzureScoreMetadataFromContainer(targetContainer);
  const diffs = computeReconciliation(votes, mirrorScores, target || undefined);
  const report = { store: "cosmos", mode, dryRun: !apply, diffCount: diffs.length, diffs, applied: false };
  if (apply) {
    if (mode === "pre-rollback") {
      await writeLegacyScores(targetContainer, diffs);
    } else {
      await writeAzureScoreMetadata(targetContainer, diffs);
    }
    report.applied = true;
  }
  return report;
}

async function runCosmosMode(values) {
  if (!values["cosmos-endpoint"]) {
    throw new Error("--cosmos-endpoint (or --fixture) is required.");
  }
  if (values.apply && values.confirm !== CONFIRM_PHRASE) {
    throw new ReconcileConfirmError(
      `Refusing to apply: --confirm must exactly equal '${CONFIRM_PHRASE}' (got '${values.confirm || "<empty>"}')`
    );
  }

  let CosmosClient, DefaultAzureCredential;
  try {
    ({ CosmosClient } = await import("@azure/cosmos"));
    ({ DefaultAzureCredential } = await import("@azure/identity"));
  } catch (err) {
    throw new Error(
      "Real Cosmos reconciliation requires '@azure/cosmos' and '@azure/identity' to be installed " +
        "(this is intentionally not a default dependency of scripts/azure). " +
        "Run with --fixture for offline/dry testing, or install these packages before using this mode. " +
        `Original error: ${err && err.message ? err.message : err}`
    );
  }

  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: values["cosmos-endpoint"], aadCredentials: credential });
  const database = client.database(values.database);
  const votesContainer = database.container(values["votes-container"]);
  // backfill/post-cutover reconcile the same-partition score metadata doc
  // living in the votes container itself; only pre-rollback targets the
  // separate legacy scores container.
  const targetContainer = values.mode === "pre-rollback" ? database.container(values["scores-container"]) : votesContainer;

  return reconcileFromContainers(votesContainer, targetContainer, {
    mode: values.mode,
    target: values.target || undefined,
    apply: values.apply,
  });
}

/**
 * Resolves the post-cutover wait-gate reference timestamp from CLI values,
 * preferring an explicit --since over --cutover-manifest, and returns null
 * when neither is given.
 */
function resolveWaitGateReference(values) {
  if (values.since) return values.since;
  if (values["cutover-manifest"]) return resolveCutApiTimestamp(values["cutover-manifest"]);
  return null;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), ARG_SPEC);
  } catch (err) {
    if (err instanceof CliArgError) {
      console.error(err.message);
      console.error(usage());
      process.exit(2);
    }
    throw err;
  }
  const { values } = parsed;
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  try {
    validateMode(values.mode);

    const waitGateReference = resolveWaitGateReference(values);
    if (values.mode !== "post-cutover") {
      if (waitGateReference !== null) {
        throw new Error(
          `--cutover-manifest/--since only apply to --mode post-cutover (the only phase with a DNS TTL wait gate); ` +
            `got --mode ${values.mode}. Omit them for backfill/pre-rollback runs, which are never time-gated.`
        );
      }
    } else if (values.apply) {
      if (waitGateReference === null) {
        throw new PostCutoverWaitError(
          "--mode post-cutover --apply requires --cutover-manifest <path> or --since <iso-timestamp> to prove the " +
            "Cloudflare DNS TTL wait gate has elapsed. Dry runs may omit this."
        );
      }
      const minWaitSeconds = Number(values["min-wait-seconds"]);
      const gate = checkMinimumWaitElapsed(waitGateReference, minWaitSeconds);
      if (!gate.ok) {
        throw new PostCutoverWaitError(
          `Refusing to apply: only ${Math.floor(gate.elapsedSeconds)}s have elapsed since cut-api (${waitGateReference}); ` +
            `at least ${gate.requiredSeconds}s must pass (Cloudflare's ${CLOUDFLARE_DNS_TTL_SECONDS}s proxied DNS TTL, per policy) ` +
            "so votes written late by the legacy Cloudflare Worker have time to land before this reconciliation absorbs them."
        );
      }
    }

    const report = values.fixture ? await runFixtureMode(values) : await runCosmosMode(values);
    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Store: ${report.store}  Mode: ${report.mode}  dryRun: ${report.dryRun}  diffs: ${report.diffCount}`);
      for (const diff of report.diffs) {
        console.log(
          `  ${diff.target}: legacy=${diff.legacyCount} authoritative=${diff.authoritativeCount} delta=${diff.delta}`
        );
      }
      if (report.applied) {
        console.log(`Applied. ${report.outputPath ? `Output: ${report.outputPath}` : ""}`);
      } else if (report.diffCount > 0) {
        console.log(`Dry run only. Re-run with --apply --confirm ${CONFIRM_PHRASE} to write these ${report.diffCount} correction(s).`);
      } else {
        console.log("No reconciliation needed; the target mirror already matches authoritative vote counts.");
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
