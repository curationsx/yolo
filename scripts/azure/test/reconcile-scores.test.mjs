// scripts/azure/test/reconcile-scores.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  computeReconciliation,
  checkMinimumWaitElapsed,
  resolveCutApiTimestamp,
  validateMode,
  DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS,
  RECONCILE_MODES,
  fetchVotesFromContainer,
  fetchAzureScoreMetadataFromContainer,
  writeAzureScoreMetadata,
  fetchLegacyScoresFromContainer,
  reconcileFromContainers,
} from "../reconcile-scores.mjs";
import { FakeVotesContainer, FakeScoresContainer } from "./helpers/fake-cosmos-container.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "reconcile-scores.mjs");
const FIXTURE = path.join(__dirname, "fixtures", "data", "reconcile-sample.json");
// Unique per process (this repo is worked on by multiple concurrent agent
// lanes sharing the same checkout; a fixed scratch path would race if two
// test runs overlap).
const SCRATCH = path.join(__dirname, `.tmp-reconcile-${process.pid}`);

test.before(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
});

test.after(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

test("computeReconciliation finds drifted and matching targets", () => {
  const votes = [
    { target: "a", viewerId: "u1", direction: 1 },
    { target: "a", viewerId: "u2", direction: 1 },
    { target: "b", viewerId: "u1", direction: 1 },
  ];
  const legacyScores = [
    { target: "a", count: 5 },
    { target: "b", count: 1 },
  ];
  const diffs = computeReconciliation(votes, legacyScores);
  assert.deepEqual(
    diffs.find((d) => d.target === "a"),
    { target: "a", legacyCount: 5, authoritativeCount: 2, delta: -3 }
  );
  assert.equal(
    diffs.find((d) => d.target === "b"),
    undefined,
    "matching target should not appear in the diff"
  );
});

test("computeReconciliation surfaces targets present only in legacy scores", () => {
  const diffs = computeReconciliation([], [{ target: "stale", count: 3 }]);
  assert.deepEqual(diffs, [{ target: "stale", legacyCount: 3, authoritativeCount: 0, delta: -3 }]);
});

test("computeReconciliation respects an onlyTarget filter", () => {
  const votes = [
    { target: "a", viewerId: "u1", direction: 1 },
    { target: "b", viewerId: "u1", direction: 1 },
  ];
  const legacyScores = [
    { target: "a", count: 9 },
    { target: "b", count: 9 },
  ];
  const diffs = computeReconciliation(votes, legacyScores, "a");
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].target, "a");
});

test("validateMode accepts each of the three real phases and rejects anything else", () => {
  for (const mode of RECONCILE_MODES) {
    assert.doesNotThrow(() => validateMode(mode));
  }
  assert.throws(() => validateMode(""), /--mode is required/);
  assert.throws(() => validateMode("bogus"), /--mode is required and must be one of/);
});

test("CLI: --mode is required", () => {
  let stderr = "";
  try {
    execFileSync("node", [SCRIPT, "--fixture", FIXTURE, "--json"], { encoding: "utf8", stdio: "pipe" });
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /--mode is required/);
});

test("CLI: fixture mode dry run reports diffs and writes nothing", () => {
  const out = execFileSync("node", [SCRIPT, "--mode", "backfill", "--fixture", FIXTURE, "--json"], { encoding: "utf8" });
  const report = JSON.parse(out);
  assert.equal(report.dryRun, true);
  assert.equal(report.applied, false);
  assert.equal(report.diffCount, 2);
  const outputFile = `${FIXTURE}.reconciled.json`;
  assert.equal(fs.existsSync(outputFile), false, "dry run must not write an output file");
});

test("CLI: fixture mode refuses --apply without --confirm", () => {
  assert.throws(() => {
    execFileSync("node", [SCRIPT, "--mode", "backfill", "--fixture", FIXTURE, "--apply", "--json"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  }, /Command failed/);
});

test("CLI: fixture mode refuses --apply with the wrong --confirm value", () => {
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--mode", "backfill", "--fixture", FIXTURE, "--apply", "--confirm", "nope", "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /must exactly equal 'reconcile-scores'/);
});

test("CLI: fixture mode applies and writes a reconciled output file when confirmed", () => {
  const outPath = path.join(SCRATCH, "reconciled.json");
  const out = execFileSync(
    "node",
    [
      SCRIPT,
      "--mode",
      "backfill",
      "--fixture",
      FIXTURE,
      "--fixture-out",
      outPath,
      "--apply",
      "--confirm",
      "reconcile-scores",
      "--json",
    ],
    { encoding: "utf8" }
  );
  const report = JSON.parse(out);
  assert.equal(report.applied, true);
  assert.equal(report.outputPath, outPath);
  const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const wiltern = written.scores.find((s) => s.target === "venue:the-wiltern");
  assert.equal(wiltern.count, 1);
  const stale = written.scores.find((s) => s.target === "venue:stale-only-in-legacy");
  assert.equal(stale.count, 0);
});

test("CLI: cosmos mode without --fixture requires --cosmos-endpoint", () => {
  let stderr = "";
  try {
    execFileSync("node", [SCRIPT, "--mode", "backfill", "--json"], { encoding: "utf8", stdio: "pipe" });
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /--cosmos-endpoint/);
});

test("CLI: cosmos mode refuses --apply without --confirm before ever importing @azure/cosmos", () => {
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--mode", "backfill", "--cosmos-endpoint", "https://fixture.example", "--apply", "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /must exactly equal 'reconcile-scores'/);
});

// --- --mode / wait-gate cross-validation -------------------------------

test("CLI: --cutover-manifest with --mode backfill is refused (only post-cutover is time-gated)", () => {
  const manifestPath = path.join(SCRATCH, "cross-validate-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ steps: [{ name: "cut-api", appliedAt: new Date().toISOString() }] }));
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--mode", "backfill", "--fixture", FIXTURE, "--cutover-manifest", manifestPath, "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /only apply to --mode post-cutover/);
});

test("CLI: --since with --mode pre-rollback is refused (only post-cutover is time-gated)", () => {
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--mode", "pre-rollback", "--fixture", FIXTURE, "--since", new Date().toISOString(), "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /only apply to --mode post-cutover/);
});

test("CLI: --mode post-cutover --apply without --cutover-manifest or --since is refused", () => {
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--mode", "post-cutover", "--fixture", FIXTURE, "--apply", "--confirm", "reconcile-scores", "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /requires --cutover-manifest .* or --since/);
});

test("CLI: --mode post-cutover dry run is allowed without --cutover-manifest or --since", () => {
  const out = JSON.parse(
    execFileSync("node", [SCRIPT, "--mode", "post-cutover", "--fixture", FIXTURE, "--json"], { encoding: "utf8" })
  );
  assert.equal(out.dryRun, true);
  assert.equal(out.mode, "post-cutover");
});

// --- post-cutover wait gate (Cloudflare DNS TTL race) -----------------

test("checkMinimumWaitElapsed reports not-ok when insufficient time has passed", () => {
  const reference = new Date(Date.now() - 30_000).toISOString(); // 30s ago
  const result = checkMinimumWaitElapsed(reference, DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS);
  assert.equal(result.ok, false);
  assert.ok(result.elapsedSeconds < DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS);
});

test("checkMinimumWaitElapsed reports ok once at least the minimum wait has passed", () => {
  const reference = new Date(Date.now() - 700_000).toISOString(); // ~11.7 minutes ago
  const result = checkMinimumWaitElapsed(reference, DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS);
  assert.equal(result.ok, true);
});

test("checkMinimumWaitElapsed supports an injectable clock for deterministic tests", () => {
  const reference = "2026-01-01T00:00:00.000Z";
  const nowFn = () => new Date("2026-01-01T00:09:00.000Z"); // 9 minutes later
  const result = checkMinimumWaitElapsed(reference, 600, nowFn);
  assert.equal(result.ok, false);
  assert.equal(Math.round(result.elapsedSeconds), 540);
});

test("checkMinimumWaitElapsed throws on an invalid reference timestamp", () => {
  assert.throws(() => checkMinimumWaitElapsed("not-a-date", 600), /Invalid reference timestamp/);
});

test("resolveCutApiTimestamp reads the cut-api step's appliedAt from a cutover manifest", () => {
  const manifestPath = path.join(SCRATCH, "cutover-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      steps: [
        { name: "validate-swa-root", appliedAt: "2026-01-01T00:00:00.000Z" },
        { name: "cut-api", appliedAt: "2026-01-01T00:05:00.000Z" },
        { name: "cut-root", appliedAt: "2026-01-01T00:06:00.000Z" },
      ],
    })
  );
  assert.equal(resolveCutApiTimestamp(manifestPath), "2026-01-01T00:05:00.000Z");
});

test("resolveCutApiTimestamp refuses a manifest with no recorded cut-api step", () => {
  const manifestPath = path.join(SCRATCH, "cutover-manifest-no-api.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ steps: [{ name: "cut-root", appliedAt: "2026-01-01T00:00:00.000Z" }] }));
  assert.throws(() => resolveCutApiTimestamp(manifestPath), /no recorded 'cut-api' step/);
});

test("CLI: --mode post-cutover --apply with --since too recent refuses to write (dry run still allowed)", () => {
  const fixture = path.join(SCRATCH, "wait-gate-recent.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));
  const recentTimestamp = new Date().toISOString();

  // Dry run is never gated -- it must still compute and report the diff.
  const dryOut = JSON.parse(
    execFileSync(
      "node",
      [SCRIPT, "--mode", "post-cutover", "--fixture", fixture, "--since", recentTimestamp, "--json"],
      { encoding: "utf8" }
    )
  );
  assert.equal(dryOut.dryRun, true);
  assert.equal(dryOut.diffCount, 2);

  let stderr = "";
  try {
    execFileSync(
      "node",
      [
        SCRIPT,
        "--mode",
        "post-cutover",
        "--fixture",
        fixture,
        "--since",
        recentTimestamp,
        "--apply",
        "--confirm",
        "reconcile-scores",
        "--json",
      ],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /Refusing to apply.*elapsed since cut-api/s);
  assert.equal(fs.existsSync(`${fixture}.reconciled.json`), false, "must not write when the wait gate refuses");
});

test("CLI: --mode post-cutover --apply with --since old enough proceeds and writes", () => {
  const fixture = path.join(SCRATCH, "wait-gate-old.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));
  const oldTimestamp = new Date(Date.now() - 700_000).toISOString();

  const out = JSON.parse(
    execFileSync(
      "node",
      [
        SCRIPT,
        "--mode",
        "post-cutover",
        "--fixture",
        fixture,
        "--since",
        oldTimestamp,
        "--apply",
        "--confirm",
        "reconcile-scores",
        "--json",
      ],
      { encoding: "utf8" }
    )
  );
  assert.equal(out.applied, true);
  assert.ok(fs.existsSync(out.outputPath));
});

test("CLI: --mode post-cutover --apply gated by --cutover-manifest's cut-api timestamp", () => {
  const fixture = path.join(SCRATCH, "wait-gate-manifest.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));

  const recentManifest = path.join(SCRATCH, "cutover-manifest-recent.json");
  fs.writeFileSync(recentManifest, JSON.stringify({ steps: [{ name: "cut-api", appliedAt: new Date().toISOString() }] }));
  let stderr = "";
  try {
    execFileSync(
      "node",
      [
        SCRIPT,
        "--mode",
        "post-cutover",
        "--fixture",
        fixture,
        "--cutover-manifest",
        recentManifest,
        "--apply",
        "--confirm",
        "reconcile-scores",
      ],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /Refusing to apply/);

  const oldManifest = path.join(SCRATCH, "cutover-manifest-old.json");
  fs.writeFileSync(
    oldManifest,
    JSON.stringify({ steps: [{ name: "cut-api", appliedAt: new Date(Date.now() - 700_000).toISOString() }] })
  );
  const out = JSON.parse(
    execFileSync(
      "node",
      [
        SCRIPT,
        "--mode",
        "post-cutover",
        "--fixture",
        fixture,
        "--cutover-manifest",
        oldManifest,
        "--apply",
        "--confirm",
        "reconcile-scores",
        "--json",
      ],
      { encoding: "utf8" }
    )
  );
  assert.equal(out.applied, true);
});

// --- idempotency and late-vote absorption ------------------------------

test("reconciliation is idempotent: re-applying immediately produces zero further diffs", () => {
  const fixture = path.join(SCRATCH, "idempotent.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));

  const firstOut = JSON.parse(
    execFileSync(
      "node",
      [SCRIPT, "--mode", "backfill", "--fixture", fixture, "--apply", "--confirm", "reconcile-scores", "--json"],
      { encoding: "utf8" }
    )
  );
  assert.equal(firstOut.applied, true);
  assert.ok(firstOut.diffCount > 0);

  // Re-run reconciliation reading the just-reconciled output as the new
  // "current mirror" state (votes are unchanged) -- nothing left to do.
  const reconciledScores = JSON.parse(fs.readFileSync(firstOut.outputPath, "utf8"));
  const originalFixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const convergedFixture = path.join(SCRATCH, "idempotent-converged.json");
  fs.writeFileSync(convergedFixture, JSON.stringify({ votes: originalFixture.votes, scores: reconciledScores.scores }));

  const secondOut = JSON.parse(
    execFileSync("node", [SCRIPT, "--mode", "backfill", "--fixture", convergedFixture, "--json"], { encoding: "utf8" })
  );
  assert.equal(secondOut.diffCount, 0, "a converged mirror must produce zero further diffs");
});

test("post-cutover reconciliation absorbs votes written late by the legacy Cloudflare Worker, and stays idempotent afterward", () => {
  // Simulate: pre-cutover backfill already converged score metadata to
  // match the votes that existed at that time.
  const convergedVotes = [
    { target: "venue:the-wiltern", viewerId: "user-1", direction: 1 },
    { target: "venue:the-wiltern", viewerId: "user-2", direction: 1 },
  ];
  const convergedScores = [{ target: "venue:the-wiltern", count: 2 }];

  // During the Cloudflare DNS TTL race window, the legacy Worker writes
  // one more vote (and the legacy `scores` container, which this
  // reconciliation does not read) WITHOUT updating Azure's score metadata.
  const lateVotes = [...convergedVotes, { target: "venue:the-wiltern", viewerId: "user-3", direction: 1 }];

  const raceFixture = path.join(SCRATCH, "race-window.json");
  fs.writeFileSync(raceFixture, JSON.stringify({ votes: lateVotes, scores: convergedScores }));

  const oldManifest = path.join(SCRATCH, "race-window-manifest.json");
  fs.writeFileSync(
    oldManifest,
    JSON.stringify({ steps: [{ name: "cut-api", appliedAt: new Date(Date.now() - 700_000).toISOString() }] })
  );

  const applyOut = path.join(SCRATCH, "race-window.reconciled.json");
  const report = JSON.parse(
    execFileSync(
      "node",
      [
        SCRIPT,
        "--mode",
        "post-cutover",
        "--fixture",
        raceFixture,
        "--cutover-manifest",
        oldManifest,
        "--fixture-out",
        applyOut,
        "--apply",
        "--confirm",
        "reconcile-scores",
        "--json",
      ],
      { encoding: "utf8" }
    )
  );
  assert.equal(report.applied, true);
  assert.equal(report.diffCount, 1);
  assert.equal(report.diffs[0].delta, 1, "the one late vote must be absorbed");

  const written = JSON.parse(fs.readFileSync(applyOut, "utf8"));
  assert.equal(written.scores.find((s) => s.target === "venue:the-wiltern").count, 3);

  // Running it again (e.g. because even later votes might still trickle
  // in) with the same votes/scores must be a safe no-op.
  const secondRaceFixture = path.join(SCRATCH, "race-window-converged.json");
  fs.writeFileSync(secondRaceFixture, JSON.stringify({ votes: lateVotes, scores: written.scores }));
  const secondReport = JSON.parse(
    execFileSync("node", [SCRIPT, "--mode", "post-cutover", "--fixture", secondRaceFixture, "--json"], { encoding: "utf8" })
  );
  assert.equal(secondReport.diffCount, 0, "re-running after absorbing late votes must be idempotent");
});

// --- Real (non-fixture) Cosmos container schema tests, all three phases ---
//
// These exercise fetchVotesFromContainer/fetchAzureScoreMetadataFromContainer/
// writeAzureScoreMetadata/fetchLegacyScoresFromContainer/
// reconcileFromContainers directly against lightweight fake containers
// (see test/helpers/fake-cosmos-container.mjs), without needing the
// optional @azure/cosmos/@azure/identity packages installed or a live
// Cosmos account. This is the query/write logic runCosmosMode actually
// runs in production -- the fixture-mode tests above exercise a fully
// separate, self-contained JSON format and never touch this code path.

test("fetchVotesFromContainer counts a true legacy-shaped vote doc (no doc_type field at all)", async () => {
  const votes = new FakeVotesContainer().addLegacyVote("venue:the-wiltern", "user-1");
  const result = await fetchVotesFromContainer(votes);
  assert.deepEqual(result, [{ target: "venue:the-wiltern", viewerId: "user-1", direction: 1 }]);
});

test("fetchVotesFromContainer counts an Azure-native vote doc (doc_type: 'vote')", async () => {
  const votes = new FakeVotesContainer().addAzureVote("venue:the-wiltern", "user-1");
  const result = await fetchVotesFromContainer(votes);
  assert.deepEqual(result, [{ target: "venue:the-wiltern", viewerId: "user-1", direction: 1 }]);
});

test("fetchVotesFromContainer counts legacy and Azure-native vote docs together, excluding the score metadata doc", async () => {
  const votes = new FakeVotesContainer()
    .addLegacyVote("venue:the-wiltern", "user-1")
    .addAzureVote("venue:the-wiltern", "user-2")
    .addScoreMetadataDoc("venue:the-wiltern", 999);
  const result = await fetchVotesFromContainer(votes);
  assert.equal(result.length, 2, "the score metadata document must never be counted as a vote");
  const viewers = result.map((v) => v.viewerId).sort();
  assert.deepEqual(viewers, ["user-1", "user-2"]);
});

test("fetchAzureScoreMetadataFromContainer reads only the same-partition score doc, never a vote doc", async () => {
  const votes = new FakeVotesContainer()
    .addAzureVote("venue:the-wiltern", "user-1")
    .addLegacyVote("venue:the-wiltern", "user-2")
    .addScoreMetadataDoc("venue:the-wiltern", 7);
  const result = await fetchAzureScoreMetadataFromContainer(votes);
  assert.deepEqual(result, [{ target: "venue:the-wiltern", count: 7 }]);
});

test("--mode backfill: reconcileFromContainers absorbs a true legacy-shaped (no doc_type) vote against the same-partition Azure score metadata mirror", async () => {
  const votes = new FakeVotesContainer().addLegacyVote("venue:the-wiltern", "user-1").addLegacyVote("venue:the-wiltern", "user-2");
  // No score metadata doc exists yet -- this is the very first backfill.
  const report = await reconcileFromContainers(votes, votes, { mode: "backfill", apply: true });
  assert.equal(report.mode, "backfill");
  assert.equal(report.diffCount, 1);
  assert.equal(report.diffs[0].authoritativeCount, 2);
  assert.equal(report.applied, true);

  const written = votes.getScoreMetadataDoc("venue:the-wiltern");
  assert.equal(written.count, 2);
  assert.equal(written.doc_type, "score", "the write-back must carry the real doc_type field");
  assert.equal(written.target_id, "venue:the-wiltern", "the write-back must carry the real target_id field");

  // Idempotent: re-running with no further votes must be a no-op.
  const again = await reconcileFromContainers(votes, votes, { mode: "backfill", apply: true });
  assert.equal(again.diffCount, 0);
});

test("--mode post-cutover: reconcileFromContainers absorbs a true legacy-shaped (no doc_type) vote written late, against the same same-partition Azure score metadata mirror as backfill", async () => {
  const votes = new FakeVotesContainer()
    .addAzureVote("venue:the-wiltern", "user-1")
    .addAzureVote("venue:the-wiltern", "user-2")
    .addScoreMetadataDoc("venue:the-wiltern", 2);

  // Pre-absorption: authoritative (2 Azure votes) already matches the mirror.
  const before = await reconcileFromContainers(votes, votes, { mode: "post-cutover" });
  assert.equal(before.diffCount, 0);

  // The legacy Cloudflare Worker writes a genuinely legacy-shaped vote doc
  // (no doc_type at all) during the post-cutover DNS TTL race window,
  // without updating the score mirror.
  votes.addLegacyVote("venue:the-wiltern", "user-3");

  const after = await reconcileFromContainers(votes, votes, { mode: "post-cutover", apply: true });
  assert.equal(after.diffCount, 1);
  assert.equal(after.diffs[0].authoritativeCount, 3, "the late legacy-shaped vote must be counted");
  assert.equal(after.applied, true);

  const written = votes.getScoreMetadataDoc("venue:the-wiltern");
  assert.equal(written.count, 3);
  assert.equal(written.target_id, "venue:the-wiltern");

  // Idempotent: re-running with no further votes must be a no-op that
  // still reads back correctly (proves the write-back shape round-trips).
  const again = await reconcileFromContainers(votes, votes, { mode: "post-cutover", apply: true });
  assert.equal(again.diffCount, 0);
});

test("--mode pre-rollback: reconcileFromContainers absorbs a true legacy-shaped (no doc_type) vote against the separate legacy scores container mirror", async () => {
  const votes = new FakeVotesContainer()
    .addAzureVote("venue:the-wiltern", "user-1")
    .addAzureVote("venue:the-wiltern", "user-2");
  const scores = new FakeScoresContainer([
    { id: "venue:the-wiltern", scope: "global", target_id: "venue:the-wiltern", count: 2, updated_at: new Date().toISOString() },
  ]);

  const before = await reconcileFromContainers(votes, scores, { mode: "pre-rollback" });
  assert.equal(before.diffCount, 0);

  // A true legacy-shaped vote (no doc_type) lands right before rollback.
  votes.addLegacyVote("venue:the-wiltern", "user-3");

  const after = await reconcileFromContainers(votes, scores, { mode: "pre-rollback", apply: true });
  assert.equal(after.diffCount, 1);
  assert.equal(after.diffs[0].authoritativeCount, 3, "the late legacy-shaped vote must be counted");
  assert.equal(after.applied, true);

  const written = scores.docs.get("venue:the-wiltern");
  assert.equal(written.count, 3);
  assert.equal(written.scope, "global", "the write-back must carry the real partition key field");
  assert.equal(written.target_id, "venue:the-wiltern", "the write-back must carry the real target_id field");

  // Idempotent: re-running with no further votes must be a no-op.
  const again = await reconcileFromContainers(votes, scores, { mode: "pre-rollback", apply: true });
  assert.equal(again.diffCount, 0);
});

test("reconcileFromContainers requires a valid --mode and never guesses which mirror to use", async () => {
  const votes = new FakeVotesContainer();
  const scores = new FakeScoresContainer();
  await assert.rejects(reconcileFromContainers(votes, scores, {}), /--mode is required/);
  await assert.rejects(reconcileFromContainers(votes, scores, { mode: "bogus" }), /--mode is required and must be one of/);
});

test("writeAzureScoreMetadata is rejected by a real-shaped votes container if the target_id partition key is dropped (regression guard)", async () => {
  const votes = new FakeVotesContainer();
  await assert.rejects(
    votes.items.upsert({ id: "score", doc_type: "score", count: 3 }),
    /missing the 'target_id' partition key field/
  );
  // The actual write path always supplies target_id and must succeed.
  await writeAzureScoreMetadata(votes, [{ target: "venue:echoplex", authoritativeCount: 1 }]);
  assert.equal(votes.getScoreMetadataDoc("venue:echoplex").count, 1);
});

test("FakeScoresContainer rejects the old buggy write-back shape (regression guard for the missing-partition-key bug)", async () => {
  // Proves the fake container would have caught the earlier bug where the
  // write-back upserted {id, target, count} instead of the real
  // {id, scope, target_id, count, updated_at} shape -- i.e. this test
  // fails loudly if that regression is ever reintroduced.
  const scores = new FakeScoresContainer();
  await assert.rejects(
    scores.items.upsert({ id: "venue:echoplex", target: "venue:echoplex", count: 3 }),
    /missing the 'scope' partition key field/
  );

  // The actual (fixed) write-back path supplies the real shape and must
  // succeed against the same container.
  const votes = new FakeVotesContainer().addLegacyVote("venue:echoplex", "user-1");
  const report = await reconcileFromContainers(votes, scores, { mode: "pre-rollback", apply: true });
  assert.equal(report.applied, true);
  assert.equal(scores.docs.get("venue:echoplex").scope, "global");
});

test("fetchLegacyScoresFromContainer reads the real target_id-keyed legacy scores shape", async () => {
  const scores = new FakeScoresContainer([
    { id: "venue:echoplex", scope: "global", target_id: "venue:echoplex", count: 5, updated_at: new Date().toISOString() },
  ]);
  const result = await fetchLegacyScoresFromContainer(scores);
  assert.deepEqual(result, [{ target: "venue:echoplex", count: 5 }]);
});

// --- source-reproducible real Cosmos dependency resolution -------------
//
// scripts/azure/package.json pins @azure/cosmos/@azure/identity as
// ordinary `dependencies` (matching agent-worker's current ranges) with a
// committed scripts/azure/package-lock.json specifically so real
// reconciliation never depends on an untracked, undocumented ad-hoc
// install -- `npm ci --prefix scripts/azure` alone must make them
// resolvable. This is a *conditional* test: if node_modules hasn't been
// installed in this run (e.g. a bare checkout that only ever exercises
// --fixture, which needs no install at all), it is skipped rather than
// failed, since fixture/dry-run behavior must never depend on these
// packages being present.
test("real Cosmos mode's dynamic imports resolve once scripts/azure's own dependencies are installed (npm ci --prefix scripts/azure)", async (t) => {
  let cosmosAvailable = true;
  try {
    await import("@azure/cosmos");
    await import("@azure/identity");
  } catch {
    cosmosAvailable = false;
  }
  if (!cosmosAvailable) {
    t.skip("@azure/cosmos/@azure/identity not installed in this run -- run `npm ci --prefix scripts/azure` to exercise this test");
    return;
  }
  // Confirms scripts/azure/package.json's pinned dependencies are what
  // actually get resolved (not some other package on the module
  // resolution path), matching agent-worker's current ranges.
  const { name: cosmosName, version: cosmosVersion } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "node_modules", "@azure", "cosmos", "package.json"), "utf8")
  );
  assert.equal(cosmosName, "@azure/cosmos");
  assert.match(cosmosVersion, /^4\./, "expected a @azure/cosmos v4.x release, matching the ^4.9.3 pin");
});
