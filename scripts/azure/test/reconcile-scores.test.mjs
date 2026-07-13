// scripts/azure/test/reconcile-scores.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { computeReconciliation, checkMinimumWaitElapsed, resolveCutApiTimestamp, DEFAULT_POST_CUTOVER_MIN_WAIT_SECONDS } from "../reconcile-scores.mjs";

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

test("CLI: fixture mode dry run reports diffs and writes nothing", () => {
  const out = execFileSync("node", [SCRIPT, "--fixture", FIXTURE, "--json"], { encoding: "utf8" });
  const report = JSON.parse(out);
  assert.equal(report.dryRun, true);
  assert.equal(report.applied, false);
  assert.equal(report.diffCount, 2);
  const outputFile = `${FIXTURE}.reconciled.json`;
  assert.equal(fs.existsSync(outputFile), false, "dry run must not write an output file");
});

test("CLI: fixture mode refuses --apply without --confirm", () => {
  assert.throws(() => {
    execFileSync("node", [SCRIPT, "--fixture", FIXTURE, "--apply", "--json"], { encoding: "utf8", stdio: "pipe" });
  }, /Command failed/);
});

test("CLI: fixture mode refuses --apply with the wrong --confirm value", () => {
  let stderr = "";
  try {
    execFileSync("node", [SCRIPT, "--fixture", FIXTURE, "--apply", "--confirm", "nope", "--json"], {
      encoding: "utf8",
      stdio: "pipe",
    });
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
    [SCRIPT, "--fixture", FIXTURE, "--fixture-out", outPath, "--apply", "--confirm", "reconcile-scores", "--json"],
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
    execFileSync("node", [SCRIPT, "--json"], { encoding: "utf8", stdio: "pipe" });
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
      [SCRIPT, "--cosmos-endpoint", "https://fixture.example", "--apply", "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /must exactly equal 'reconcile-scores'/);
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

test("CLI: --apply with --since too recent refuses to write (dry run still allowed)", () => {
  const fixture = path.join(SCRATCH, "wait-gate-recent.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));
  const recentTimestamp = new Date().toISOString();

  // Dry run is never gated -- it must still compute and report the diff.
  const dryOut = JSON.parse(
    execFileSync("node", [SCRIPT, "--fixture", fixture, "--since", recentTimestamp, "--json"], { encoding: "utf8" })
  );
  assert.equal(dryOut.dryRun, true);
  assert.equal(dryOut.diffCount, 2);

  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--fixture", fixture, "--since", recentTimestamp, "--apply", "--confirm", "reconcile-scores", "--json"],
      { encoding: "utf8", stdio: "pipe" }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /Refusing to apply.*elapsed since cut-api/s);
  assert.equal(fs.existsSync(`${fixture}.reconciled.json`), false, "must not write when the wait gate refuses");
});

test("CLI: --apply with --since old enough proceeds and writes", () => {
  const fixture = path.join(SCRATCH, "wait-gate-old.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));
  const oldTimestamp = new Date(Date.now() - 700_000).toISOString();

  const out = JSON.parse(
    execFileSync(
      "node",
      [SCRIPT, "--fixture", fixture, "--since", oldTimestamp, "--apply", "--confirm", "reconcile-scores", "--json"],
      { encoding: "utf8" }
    )
  );
  assert.equal(out.applied, true);
  assert.ok(fs.existsSync(out.outputPath));
});

test("CLI: --apply gated by --cutover-manifest's cut-api timestamp", () => {
  const fixture = path.join(SCRATCH, "wait-gate-manifest.json");
  fs.writeFileSync(fixture, fs.readFileSync(FIXTURE));

  const recentManifest = path.join(SCRATCH, "cutover-manifest-recent.json");
  fs.writeFileSync(recentManifest, JSON.stringify({ steps: [{ name: "cut-api", appliedAt: new Date().toISOString() }] }));
  let stderr = "";
  try {
    execFileSync(
      "node",
      [SCRIPT, "--fixture", fixture, "--cutover-manifest", recentManifest, "--apply", "--confirm", "reconcile-scores"],
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
      [SCRIPT, "--fixture", fixture, "--cutover-manifest", oldManifest, "--apply", "--confirm", "reconcile-scores", "--json"],
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
      [SCRIPT, "--fixture", fixture, "--apply", "--confirm", "reconcile-scores", "--json"],
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
    execFileSync("node", [SCRIPT, "--fixture", convergedFixture, "--json"], { encoding: "utf8" })
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
    execFileSync("node", [SCRIPT, "--fixture", secondRaceFixture, "--json"], { encoding: "utf8" })
  );
  assert.equal(secondReport.diffCount, 0, "re-running after absorbing late votes must be idempotent");
});
