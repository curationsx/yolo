#!/usr/bin/env node
// scripts/azure/reconcile-scores.mjs
//
// Implements the approved reconciliation path from .azure/deployment-plan.md
// ("Azure State Model" / caj-yolo-ops). The `votes` container is always the
// authoritative source of truth; this tool rebuilds a target mirror's
// per-partition counts from it. The same computation serves three distinct
// procedural phases described in the plan:
//
//   1. Pre-cutover backfill -- before Azure ever serves traffic, backfill
//      Azure's score-metadata counts from the vote documents that already
//      exist. No timing gate; run whenever the infra lane needs it.
//   2. Post-cutover reconciliation (this task) -- after api.curations.dev's
//      DNS is cut to Azure, Cloudflare's proxied DNS TTL (300s) means some
//      resolvers/clients keep reaching the legacy Cloudflare Worker for a
//      while. The legacy Worker can still write `votes` + the legacy
//      `scores` container during that window WITHOUT updating Azure's
//      score metadata. Re-running this same reconciliation after the race
//      window has closed absorbs those late votes. Pass
//      --cutover-manifest <path> (or --since <iso-timestamp>) with --apply
//      and this tool REFUSES to write until at least
//      `--min-wait-seconds` (default 600s -- one old-DNS TTL, and per
//      explicit preference never less than 10 minutes) has elapsed since
//      the cutover's recorded `cut-api` step. Dry run is never gated by
//      this -- only --apply is.
//   3. Pre-rollback reconciliation -- before falling back to Cloudflare,
//      reconcile the legacy `scores` container from the authoritative vote
//      partitions so Cloudflare's compatibility store is correct again. No
//      timing gate; run immediately before rollback.
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
// Two operating modes:
//   --fixture <path>   Offline/test mode: reads a local JSON fixture
//                       describing vote partitions and the target mirror
//                       (score metadata or legacy scores -- structurally
//                       identical, just a list of {target, count}),
//                       computes the diff, and (with --apply) writes the
//                       reconciled result back to a local output file.
//                       Never touches real Azure. This is the mode used by
//                       scripts/azure/test/** and by this task, which
//                       forbids real production mutation.
//   (no --fixture)     Real mode: connects to the existing Cosmos account
//                       via managed identity using @azure/identity +
//                       @azure/cosmos. These packages are an intentional
//                       *optional* dependency -- they are only imported
//                       when this mode actually runs, so scripts/azure has
//                       no install requirement for dry-run/fixture use.
//                       Install them (`npm install @azure/cosmos
//                       @azure/identity` in the ops job's own package) before
//                       using this mode for real.
//
// Usage:
//   node scripts/azure/reconcile-scores.mjs --fixture path/to/fixture.json [--apply --confirm reconcile-scores] [--json]
//   node scripts/azure/reconcile-scores.mjs --fixture path/to/fixture.json \
//     --cutover-manifest path/to/cutover-manifest.json \
//     [--min-wait-seconds 600] [--apply --confirm reconcile-scores] [--json]
//   node scripts/azure/reconcile-scores.mjs --cosmos-endpoint <uri> --database curations \
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

const ARG_SPEC = {
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
  return `Usage: node scripts/azure/reconcile-scores.mjs --fixture <path> [--apply --confirm ${CONFIRM_PHRASE}] [--json]
       node scripts/azure/reconcile-scores.mjs --fixture <path> --cutover-manifest <path>
                        [--min-wait-seconds ${DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS}] [--apply --confirm ${CONFIRM_PHRASE}] [--json]
       node scripts/azure/reconcile-scores.mjs --cosmos-endpoint <uri> [--database curations]
                        [--votes-container votes] [--scores-container scores]
                        [--target <scope>] [--apply --confirm ${CONFIRM_PHRASE}] [--json]

Rebuilds a target mirror's score counts from authoritative vote partitions.
Dry run by default; requires both --apply and --confirm ${CONFIRM_PHRASE} to write.
Idempotent: safe to re-run any number of times, including to absorb votes
written late by the legacy Cloudflare Worker during the DNS TTL race window.
When --cutover-manifest or --since is given, --apply refuses to write until
--min-wait-seconds (default ${DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS}) have elapsed since cut-api.`;
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

/**
 * Pure diff computation: given authoritative vote documents (one per
 * viewer, grouped by target) and a target mirror's current counts, returns
 * the set of documents that must be created/updated to match reality.
 * @param {Array<{ target: string, viewerId: string, direction: 1|-1 }>} votes
 * @param {Array<{ target: string, count: number }>} legacyScores
 * @param {string} [onlyTarget]
 */
export function computeReconciliation(votes, legacyScores, onlyTarget) {
  const authoritative = new Map();
  for (const vote of votes) {
    if (onlyTarget && vote.target !== onlyTarget) continue;
    const current = authoritative.get(vote.target) || 0;
    authoritative.set(vote.target, current + (vote.direction >= 0 ? 1 : -1));
  }
  const legacyByTarget = new Map(legacyScores.map((s) => [s.target, s.count]));

  const allTargets = new Set([...authoritative.keys(), ...legacyByTarget.keys()]);
  const diffs = [];
  for (const target of allTargets) {
    if (onlyTarget && target !== onlyTarget) continue;
    const authoritativeCount = authoritative.get(target) ?? 0;
    const legacyCount = legacyByTarget.get(target) ?? 0;
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
  const legacyScores = fixture.scores || [];
  const diffs = computeReconciliation(votes, legacyScores, values.target || undefined);

  const report = {
    mode: "fixture",
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
    const reconciled = new Map(legacyScores.map((s) => [s.target, s.count]));
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
  const scoresContainer = database.container(values["scores-container"]);

  const votes = [];
  {
    // Real vote documents are shaped `{id, target_id, user_id, created_at}`
    // (see agent-worker/src/vote-guard.ts:237-243, the legacy Cloudflare
    // durable path) with no `doc_type` field at all, or `{..., doc_type:
    // "vote"}` for documents written by the Azure gateway
    // (agent-worker/src/platform/azure/community.ts). There is no stored
    // "direction": a vote document's mere existence is the vote (there is
    // no downvote concept in this schema), so it always contributes +1.
    // The same-partition score metadata document (`id: "score", doc_type:
    // "score"`) must never be counted as a vote.
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
    votes.push(...resources.map((resource) => ({ target: resource.target, viewerId: resource.viewerId, direction: 1 })));
  }
  const legacyScores = [];
  {
    // Legacy/score-mirror documents use `target_id`, not `target`
    // (agent-worker/src/community.ts's `ScoreDoc`, `agent-worker/src/
    // platform/azure/community.ts`'s same-partition score metadata doc).
    const { resources } = await scoresContainer.items
      .query("SELECT c.target_id AS target, c.count FROM c")
      .fetchAll();
    legacyScores.push(...resources);
  }

  const diffs = computeReconciliation(votes, legacyScores, values.target || undefined);
  const report = { mode: "cosmos", dryRun: !values.apply, diffCount: diffs.length, diffs, applied: false };

  if (values.apply) {
    for (const diff of diffs) {
      // One point write per corrected target; bounded, sequential, and
      // idempotent (re-running converges on the same authoritative count,
      // whether it's the first backfill, a post-cutover late-vote
      // absorption pass, or a repeat of either).
      await scoresContainer.items.upsert({ id: diff.target, target: diff.target, count: diff.authoritativeCount });
    }
    report.applied = true;
  }
  return report;
}

/**
 * Resolves the post-cutover wait-gate reference timestamp from CLI values,
 * preferring an explicit --since over --cutover-manifest, and returns null
 * when neither is given (pre-cutover backfill and pre-rollback
 * reconciliation runs are never gated).
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
    if (values.apply) {
      const waitGateReference = resolveWaitGateReference(values);
      if (waitGateReference) {
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
    }

    const report = values.fixture ? await runFixtureMode(values) : await runCosmosMode(values);
    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Mode: ${report.mode}  dryRun: ${report.dryRun}  diffs: ${report.diffCount}`);
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
