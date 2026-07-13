// scripts/azure/test/cutover.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  loadAcceptance,
  AcceptanceError,
  FixtureCloudflareClient,
  RealCloudflareClient,
  CloudflareApiError,
  loadCloudflareClient,
  computeCutoverPlan,
  runCutover,
  runRollback,
  swaValidationRecordName,
  PRODUCTION_CONFIRM_PHRASE,
  REHEARSAL_CONFIRM_PHRASE,
  SET_DEFAULT_DOMAIN_STEP,
} from "../cutover.mjs";
import { writeManifest } from "../lib/manifest-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "cutover.mjs");
const ZONE_FIXTURE = path.join(__dirname, "fixtures", "cloudflare", "zone-state.json");
const ACCEPTANCE_READY = path.join(__dirname, "fixtures", "data", "acceptance-ready.json");
const ACCEPTANCE_CERT_NOT_READY = path.join(__dirname, "fixtures", "data", "acceptance-cert-not-ready.json");
// Unique per process (this repo is worked on by multiple concurrent agent
// lanes sharing the same checkout; a fixed scratch path would race if two
// test runs overlap).
const SCRATCH = path.join(__dirname, `.tmp-cutover-${process.pid}`);

const HOSTNAMES = { root: "curations.dev", www: "www.curations.dev", api: "api.curations.dev" };

function freshZoneFixture(name) {
  const dest = path.join(SCRATCH, name);
  fs.copyFileSync(ZONE_FIXTURE, dest);
  return dest;
}

test.before(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
});

test.after(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

// --- loadAcceptance -------------------------------------------------------

test("loadAcceptance refuses when the acceptance path is missing", () => {
  assert.throws(() => loadAcceptance(""), AcceptanceError);
});

test("loadAcceptance refuses when the acceptance file does not exist", () => {
  assert.throws(() => loadAcceptance(path.join(SCRATCH, "does-not-exist.json")), AcceptanceError);
});

test("loadAcceptance refuses when tempCertReady is false", () => {
  assert.throws(() => loadAcceptance(ACCEPTANCE_CERT_NOT_READY), /tempCertReady=false/);
});

test("loadAcceptance succeeds and returns parsed data for a valid file", () => {
  const data = loadAcceptance(ACCEPTANCE_READY);
  assert.equal(data.tempCertReady, true);
  assert.match(data.apiHostname, /azurecontainerapps\.io$/);
});

// --- computeCutoverPlan ---------------------------------------------------

test("computeCutoverPlan prevalidates SWA hostnames first, then cuts API, then root, then www, then gates on the manual default-domain step", () => {
  const plan = computeCutoverPlan({
    hostnames: HOSTNAMES,
    azureTargets: { apiHostname: "gw.example", staticWebAppHostname: "site.example" },
  });
  assert.deepEqual(plan.map((s) => s.name), [
    "validate-swa-root",
    "validate-swa-www",
    "cut-api",
    "cut-root",
    "cut-www",
    "set-default-domain",
  ]);
  assert.equal(plan[0].kind, "validate");
  assert.equal(plan[2].kind, "cut");
  assert.equal(plan[5].kind, "manual-gate");
  assert.equal(plan[5].name, SET_DEFAULT_DOMAIN_STEP);
  assert.match(plan[5].instructions, /verify\.mjs/);
  assert.match(plan[5].instructions, /--check-www-redirect/);
});

test("swaValidationRecordName computes _dnsauth.<hostname> for both apex and subdomain hostnames", () => {
  assert.equal(swaValidationRecordName("curations.dev"), "_dnsauth.curations.dev");
  assert.equal(swaValidationRecordName("www.curations.dev"), "_dnsauth.www.curations.dev");
});

// --- FixtureCloudflareClient: SWA hostname prevalidation ------------------

test("requestSwaHostnameValidation is additive: it never touches an existing CNAME", async () => {
  const fixture = freshZoneFixture("swa-additive.json");
  const client = new FixtureCloudflareClient(fixture);
  const before = await client.getDnsRecord("curations.dev");
  await client.requestSwaHostnameValidation("curations.dev");
  const after = await client.getDnsRecord("curations.dev");
  assert.deepEqual(after, before, "requesting SWA validation must not mutate the existing apex CNAME");
});

test("requestSwaHostnameValidation is idempotent while still pending", async () => {
  const fixture = freshZoneFixture("swa-idempotent.json");
  const client = new FixtureCloudflareClient(fixture);
  const first = await client.requestSwaHostnameValidation("curations.dev");
  const second = await client.requestSwaHostnameValidation("curations.dev");
  assert.equal(second.validationToken, first.validationToken);
  assert.equal(second.txtRecordName, "_dnsauth.curations.dev");
});

test("getSwaHostnameStatus transitions to Ready only once the matching TXT record is published", async () => {
  const fixture = freshZoneFixture("swa-status.json");
  const client = new FixtureCloudflareClient(fixture);
  const { validationToken, txtRecordName } = await client.requestSwaHostnameValidation("www.curations.dev");
  assert.equal(await client.getSwaHostnameStatus("www.curations.dev"), "Validating");
  await client.upsertDnsRecord(txtRecordName, { type: "TXT", content: validationToken });
  assert.equal(await client.getSwaHostnameStatus("www.curations.dev"), "Ready");
});

test("getSwaHostnameStatus reports NotRequested before any validation has been requested", async () => {
  const fixture = freshZoneFixture("swa-notrequested.json");
  const client = new FixtureCloudflareClient(fixture);
  assert.equal(await client.getSwaHostnameStatus("curations.dev"), "NotRequested");
});

test("runCutover apply refuses to proceed to cut-api/cut-root/cut-www if SWA validation never becomes Ready", async () => {
  const fixture = freshZoneFixture("swa-never-ready.json");
  const client = new FixtureCloudflareClient(fixture);
  // Force getSwaHostnameStatus to always report "Validating" -- simulates
  // Azure never confirming the TXT record, e.g. because it has not
  // propagated yet.
  const originalGetStatus = client.getSwaHostnameStatus.bind(client);
  client.getSwaHostnameStatus = async (hostname) => {
    await originalGetStatus(hostname);
    return "Validating";
  };
  const manifestDir = path.join(SCRATCH, "manifests-swa-never-ready");
  await assert.rejects(
    () =>
      runCutover(
        {
          hostnames: HOSTNAMES,
          acceptancePath: ACCEPTANCE_READY,
          apply: true,
          confirm: PRODUCTION_CONFIRM_PHRASE,
          manifestDir,
        },
        { client, swaPollOptions: { retries: 2, delayMs: 1 } }
      ),
    /Verification failed after step 'validate-swa-root'/
  );
  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(
    finalState.records["curations.dev"].content,
    "curations-dev.pages.dev",
    "production apex CNAME must remain untouched when SWA prevalidation never completes"
  );
  assert.equal(finalState.workerCustomDomain.hostname, "api.curations.dev", "API must not be cut either");
});

// --- runCutover: dry run and refusal gates --------------------------------

test("runCutover dry run never mutates the fixture and requires acceptance", async () => {
  const fixture = freshZoneFixture("dryrun.json");
  const before = fs.readFileSync(fixture, "utf8");
  const client = new FixtureCloudflareClient(fixture);
  const report = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY },
    { client }
  );
  assert.equal(report.applied, false);
  assert.equal(report.dryRun, true);
  assert.equal(fs.readFileSync(fixture, "utf8"), before, "dry run must not mutate Cloudflare state");
});

test("runCutover refuses (even before touching Cloudflare) when acceptance is missing", async () => {
  const fixture = freshZoneFixture("noaccept.json");
  const client = new FixtureCloudflareClient(fixture);
  await assert.rejects(
    () => runCutover({ hostnames: HOSTNAMES, acceptancePath: "" }, { client }),
    AcceptanceError
  );
});

test("runCutover refuses to apply without --confirm matching the production phrase", async () => {
  const fixture = freshZoneFixture("badconfirm.json");
  const client = new FixtureCloudflareClient(fixture);
  const report = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: "nope" },
    { client }
  );
  assert.equal(report.applied, false);
  assert.match(report.reason, /must exactly equal/);
});

test("runCutover rehearsal mode does not require --acceptance", async () => {
  const fixture = freshZoneFixture("rehearse.json");
  const client = new FixtureCloudflareClient(fixture);
  const report = await runCutover(
    {
      hostnames: HOSTNAMES,
      rehearse: true,
      stagingApiHostname: "staging-gw.example",
      stagingStaticHostname: "staging-site.example",
    },
    { client }
  );
  assert.equal(report.applied, false);
  assert.equal(report.dryRun, true);
});

// --- runCutover: apply path, one mutation at a time -----------------------

test("runCutover apply cuts API, root, and www in order, verifying and manifesting each step, then completes once the manual default-domain step is confirmed", async () => {
  const fixture = freshZoneFixture("apply.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-apply");
  const report = await runCutover(
    {
      hostnames: HOSTNAMES,
      acceptancePath: ACCEPTANCE_READY,
      apply: true,
      confirm: PRODUCTION_CONFIRM_PHRASE,
      manifestDir,
      confirmedManualSteps: [SET_DEFAULT_DOMAIN_STEP],
    },
    { client }
  );

  assert.equal(report.applied, true);
  assert.equal(
    report.steps.map((s) => s.name).join(","),
    "validate-swa-root,validate-swa-www,cut-api,cut-root,cut-www,set-default-domain"
  );
  assert.ok(report.steps.every((s) => s.verification.ok));

  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.workerCustomDomain, null, "Worker custom domain binding must be detached, not left attached");
  assert.equal(finalState.removedWorkerCustomDomain.hostname, "api.curations.dev");
  assert.equal(
    finalState.records["api.curations.dev"].content,
    "ca-yolo-gateway.whitecliff-123456.eastus2.azurecontainerapps.io"
  );
  assert.equal(finalState.records["api.curations.dev"].type, "CNAME", "the managed AAAA record must be replaced by a DNS-only CNAME");
  assert.equal(finalState.records["api.curations.dev"].proxied, false, "the Azure CNAME must be DNS-only, not proxied");
  assert.equal(finalState.records["curations.dev"].content, "stapp-yolo-prod.azurestaticapps.net");
  assert.equal(finalState.records["www.curations.dev"].content, "stapp-yolo-prod.azurestaticapps.net");

  // The Cloudflare Advanced Certificate for api.curations.dev must survive
  // cutover byte-for-byte -- it is never auto-deleted and this tool never
  // deletes it either; it stays intact for the seven-day rollback window.
  const initialState = JSON.parse(fs.readFileSync(ZONE_FIXTURE, "utf8"));
  assert.deepEqual(finalState.advancedCertificate, initialState.advancedCertificate);

  // SWA prevalidation must have completed (both hostnames Ready) with the
  // additive _dnsauth TXT records published, before either apex/www CNAME
  // was flipped.
  assert.equal(finalState.swaHostnames["curations.dev"].status, "Ready");
  assert.equal(finalState.swaHostnames["www.curations.dev"].status, "Ready");
  assert.equal(
    finalState.records["_dnsauth.curations.dev"].content,
    finalState.swaHostnames["curations.dev"].validationToken
  );
  assert.equal(finalState.records["_dnsauth.curations.dev"].type, "TXT");
  assert.equal(
    finalState.records["_dnsauth.www.curations.dev"].content,
    finalState.swaHostnames["www.curations.dev"].validationToken
  );

  assert.ok(fs.existsSync(report.manifestPath), "rollback manifest must be written to disk");
  const manifest = JSON.parse(fs.readFileSync(report.manifestPath, "utf8"));
  assert.equal(manifest.status, "complete");
  assert.equal(manifest.snapshot.root.content, "curations-dev.pages.dev");
  assert.equal(manifest.snapshot.api.type, "AAAA", "the pre-cutover snapshot must capture Cloudflare's managed AAAA record");
  assert.equal(manifest.plan[0].kind, "validate");
  assert.equal(manifest.plan[5].kind, "manual-gate");
  assert.equal(manifest.plan[5].name, SET_DEFAULT_DOMAIN_STEP);
});

test("runCutover stops cleanly (not as a failure) at the manual default-domain gate when it is not yet confirmed", async () => {
  const fixture = freshZoneFixture("manual-gate-pending.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-manual-gate-pending");
  const report = await runCutover(
    {
      hostnames: HOSTNAMES,
      acceptancePath: ACCEPTANCE_READY,
      apply: true,
      confirm: PRODUCTION_CONFIRM_PHRASE,
      manifestDir,
      // confirmedManualSteps intentionally omitted
    },
    { client }
  );

  // Every traffic-affecting DNS mutation already succeeded -- this is not
  // an error, just an explicit stop for an unautomatable Portal action.
  assert.equal(report.applied, true);
  assert.ok(report.requiresManualStep);
  assert.equal(report.requiresManualStep.name, SET_DEFAULT_DOMAIN_STEP);
  assert.match(report.requiresManualStep.instructions, /Azure Portal/);
  assert.match(report.requiresManualStep.instructions, /verify\.mjs/);
  assert.match(report.requiresManualStep.instructions, /--check-www-redirect/);

  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.records["curations.dev"].content, "stapp-yolo-prod.azurestaticapps.net", "the DNS cutover itself must have completed even though the manual step is pending");

  const manifest = JSON.parse(fs.readFileSync(report.manifestPath, "utf8"));
  assert.equal(manifest.status, "awaiting-manual-step");
  const gateStep = manifest.steps.find((s) => s.name === SET_DEFAULT_DOMAIN_STEP);
  assert.equal(gateStep.verification.ok, false);
  assert.equal(gateStep.verification.manual, true);
  assert.match(gateStep.instructions, /Azure Portal/);
});

test("runCutover completes the manual default-domain gate once --confirmed-manual-steps includes it", async () => {
  const fixture = freshZoneFixture("manual-gate-confirmed.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-manual-gate-confirmed");
  const report = await runCutover(
    {
      hostnames: HOSTNAMES,
      acceptancePath: ACCEPTANCE_READY,
      apply: true,
      confirm: PRODUCTION_CONFIRM_PHRASE,
      manifestDir,
      confirmedManualSteps: [SET_DEFAULT_DOMAIN_STEP],
    },
    { client }
  );
  assert.equal(report.applied, true);
  assert.equal(report.requiresManualStep, undefined);
  const manifest = JSON.parse(fs.readFileSync(report.manifestPath, "utf8"));
  assert.equal(manifest.status, "complete");
  const gateStep = manifest.steps.find((s) => s.name === SET_DEFAULT_DOMAIN_STEP);
  assert.equal(gateStep.verification.ok, true);
});

test("CLI: --confirmed-manual-steps is required to reach a 'complete' cutover status", () => {
  const fixture = freshZoneFixture("cli-manual-gate.json");
  const withoutConfirm = JSON.parse(
    execFileSync(
      "node",
      [SCRIPT, "--fixture", fixture, "--acceptance", ACCEPTANCE_READY, "--apply", "--confirm", PRODUCTION_CONFIRM_PHRASE, "--json"],
      { encoding: "utf8" }
    )
  );
  assert.equal(withoutConfirm.requiresManualStep.name, SET_DEFAULT_DOMAIN_STEP);

  const fixture2 = freshZoneFixture("cli-manual-gate-confirmed.json");
  const withConfirm = JSON.parse(
    execFileSync(
      "node",
      [
        SCRIPT,
        "--fixture",
        fixture2,
        "--acceptance",
        ACCEPTANCE_READY,
        "--apply",
        "--confirm",
        PRODUCTION_CONFIRM_PHRASE,
        "--confirmed-manual-steps",
        SET_DEFAULT_DOMAIN_STEP,
        "--json",
      ],
      { encoding: "utf8" }
    )
  );
  assert.equal(withConfirm.requiresManualStep, undefined);
});

test("runCutover apply never calls a Worker-script-delete, Pages-project-delete, or certificate-delete method", async () => {
  const fixture = freshZoneFixture("no-delete.json");
  const client = new FixtureCloudflareClient(fixture);
  assert.equal(typeof client.deleteWorkerScript, "undefined");
  assert.equal(typeof client.deletePagesProject, "undefined");
  assert.equal(typeof client.deleteAdvancedCertificate, "undefined");
  assert.equal(typeof client.deleteCertificate, "undefined");
  const manifestDir = path.join(SCRATCH, "manifests-no-delete");
  await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );
});

test("cut-api confirms the managed AAAA record has disappeared (even if not instantaneous) before creating the Azure CNAME", async () => {
  const fixture = freshZoneFixture("aaaa-delayed.json");
  const client = new FixtureCloudflareClient(fixture);
  const originalGetDnsRecord = client.getDnsRecord.bind(client);
  let getCallsForApi = 0;
  let cnameCreatedAt = null;
  client.getDnsRecord = async (hostname) => {
    if (hostname === "api.curations.dev") {
      getCallsForApi++;
      if (getCallsForApi <= 2) {
        // Simulate Cloudflare taking two polls to actually remove the
        // managed AAAA record after the custom domain is detached.
        return { id: "rec-managed-aaaa-api", type: "AAAA", name: hostname, content: "100::", proxied: true, managedByWorker: true };
      }
    }
    return originalGetDnsRecord(hostname);
  };
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (hostname, opts) => {
    if (hostname === "api.curations.dev" && opts.type === "CNAME") cnameCreatedAt = getCallsForApi;
    return originalUpsert(hostname, opts);
  };

  const manifestDir = path.join(SCRATCH, "manifests-aaaa-delayed");
  const report = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client, aaaaPollOptions: { retries: 5, delayMs: 1 } }
  );
  assert.equal(report.applied, true);
  assert.ok(getCallsForApi > 2, "must have polled getDnsRecord more than twice before proceeding");
  assert.ok(cnameCreatedAt > 2, "the Azure CNAME must only be created after the managed AAAA record is confirmed gone");
});

test("cut-api refuses to create the Azure CNAME if the managed AAAA record never disappears", async () => {
  const fixture = freshZoneFixture("aaaa-never-removed.json");
  const client = new FixtureCloudflareClient(fixture);
  let upsertCalledForApi = false;
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (hostname, opts) => {
    if (hostname === "api.curations.dev") upsertCalledForApi = true;
    return originalUpsert(hostname, opts);
  };
  client.getDnsRecord = async (hostname) => {
    if (hostname === "api.curations.dev") {
      return { id: "rec-managed-aaaa-api", type: "AAAA", name: hostname, content: "100::", proxied: true, managedByWorker: true };
    }
    return { id: `rec-${hostname}`, type: "CNAME", name: hostname, content: "curations-dev.pages.dev", proxied: true };
  };

  const manifestDir = path.join(SCRATCH, "manifests-aaaa-never-removed");
  await assert.rejects(
    () =>
      runCutover(
        { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
        { client, aaaaPollOptions: { retries: 2, delayMs: 1 } }
      ),
    /did not disappear after detaching the Worker Custom Domain/
  );
  assert.equal(upsertCalledForApi, false, "the Azure CNAME must never be created while the managed AAAA record is still present");
});

test("runCutover apply stops and reports a failing step without applying later steps", async () => {
  const fixture = freshZoneFixture("verifyfail.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-verifyfail");
  let calls = 0;
  const verifyStep = async (step, c) => {
    calls++;
    if (step.name === "cut-api") return { ok: false, reason: "simulated failure" };
    return { ok: true };
  };
  await assert.rejects(
    () =>
      runCutover(
        { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
        { client, verifyStep }
      ),
    /Verification failed after step 'cut-api'/
  );
  assert.equal(
    calls,
    3,
    "must verify both SWA prevalidation steps and cut-api, but must not proceed to cut-root/cut-www after cut-api verification fails"
  );
  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.records["curations.dev"].content, "curations-dev.pages.dev", "root must remain untouched after an earlier step fails verification");
});

// --- runRollback -----------------------------------------------------------

test("runRollback restores Pages CNAMEs and the Worker custom domain binding", async () => {
  const fixture = freshZoneFixture("rollback.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-rollback");
  const cutoverReport = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );

  const rollbackDry = await runRollback({ manifestPath: cutoverReport.manifestPath }, { client });
  assert.equal(rollbackDry.applied, false, "rollback must also default to dry run");

  const rollbackReport = await runRollback(
    { manifestPath: cutoverReport.manifestPath, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE },
    { client }
  );
  assert.equal(rollbackReport.applied, true);

  const restoredState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(restoredState.records["curations.dev"].content, "curations-dev.pages.dev");
  assert.equal(restoredState.records["www.curations.dev"].content, "curations-dev.pages.dev");
  assert.equal(restoredState.workerCustomDomain.hostname, "api.curations.dev");
  assert.equal(restoredState.workerCustomDomain.service, "yolo-gateway-worker");

  // Rollback must delete the Azure CNAME and let Cloudflare recreate the
  // managed AAAA record via reattaching the Worker Custom Domain -- not
  // manually fabricate a record with the old content.
  assert.equal(restoredState.records["api.curations.dev"].type, "AAAA");
  assert.equal(restoredState.records["api.curations.dev"].content, "100::");
  assert.equal(restoredState.records["api.curations.dev"].managedByWorker, true);

  // The Advanced Certificate must have survived the full apply+rollback
  // round trip untouched.
  const initialState = JSON.parse(fs.readFileSync(ZONE_FIXTURE, "utf8"));
  assert.deepEqual(restoredState.advancedCertificate, initialState.advancedCertificate);
});

test("runRollback refuses (throws) if Cloudflare never recreates the managed AAAA record after reattaching", async () => {
  const fixture = freshZoneFixture("rollback-aaaa-never-recreated.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-rollback-aaaa-fail");
  const cutoverReport = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );

  const originalGetWorkerCustomDomain = client.getWorkerCustomDomain.bind(client);
  client.getWorkerCustomDomain = async (hostname) => {
    await originalGetWorkerCustomDomain(hostname);
    return null; // simulate Cloudflare never confirming the reattached binding
  };

  await assert.rejects(
    () =>
      runRollback(
        { manifestPath: cutoverReport.manifestPath, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE },
        { client, aaaaPollOptions: { retries: 2, delayMs: 1 } }
      ),
    /did not recreate the managed AAAA record/
  );
});

test("runRollback refuses to apply without the exact production confirm phrase", async () => {
  const fixture = freshZoneFixture("rollback-badconfirm.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-rollback-badconfirm");
  const cutoverReport = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );
  const rollbackReport = await runRollback(
    { manifestPath: cutoverReport.manifestPath, apply: true, confirm: "wrong" },
    { client }
  );
  assert.equal(rollbackReport.applied, false);
});

// --- CLI-level smoke tests --------------------------------------------------

test("CLI: dry run via subprocess exits 0 and performs no mutation", () => {
  const fixture = freshZoneFixture("cli-dryrun.json");
  const before = fs.readFileSync(fixture, "utf8");
  const out = execFileSync(
    "node",
    [SCRIPT, "--fixture", fixture, "--acceptance", ACCEPTANCE_READY, "--json"],
    { encoding: "utf8" }
  );
  const report = JSON.parse(out);
  assert.equal(report.applied, false);
  assert.equal(fs.readFileSync(fixture, "utf8"), before);
});

test("CLI: refuses when neither --fixture nor CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID are available", () => {
  let stderr = "";
  try {
    execFileSync("node", [SCRIPT, "--acceptance", ACCEPTANCE_READY, "--json"], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: "", CLOUDFLARE_ACCOUNT_ID: "" },
    });
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /--fixture/);
  assert.match(stderr, /CLOUDFLARE_API_TOKEN/);
});

test("CLI: refuses when acceptance inputs are missing, before any Cloudflare read", () => {
  const fixture = freshZoneFixture("cli-noaccept.json");
  let stderr = "";
  try {
    execFileSync("node", [SCRIPT, "--fixture", fixture, "--json"], { encoding: "utf8", stdio: "pipe" });
    assert.fail("expected non-zero exit");
  } catch (err) {
    stderr = err.stderr.toString();
  }
  assert.match(stderr, /Azure acceptance inputs/);
});

// --- loadCloudflareClient: env-var-based real client resolution -----------

test("loadCloudflareClient prefers --fixture when given, even if env vars are also present", () => {
  const fixture = freshZoneFixture("load-client-fixture-priority.json");
  const client = loadCloudflareClient(
    { fixture },
    { CLOUDFLARE_API_TOKEN: "fake-token", CLOUDFLARE_ACCOUNT_ID: "fake-account" }
  );
  assert.ok(client instanceof FixtureCloudflareClient);
});

test("loadCloudflareClient falls back to a real client when both env vars are present and no --fixture is given", () => {
  const client = loadCloudflareClient({}, { CLOUDFLARE_API_TOKEN: "fake-token", CLOUDFLARE_ACCOUNT_ID: "fake-account" });
  assert.ok(client instanceof RealCloudflareClient);
});

test("loadCloudflareClient refuses when neither --fixture nor both env vars are available", () => {
  assert.throws(() => loadCloudflareClient({}, {}), /CLOUDFLARE_API_TOKEN/);
  assert.throws(() => loadCloudflareClient({}, { CLOUDFLARE_API_TOKEN: "only-token" }), /CLOUDFLARE_ACCOUNT_ID/);
});

// --- RealCloudflareClient: real Cloudflare API v4 request shapes ---------
// All fetch calls are mocked -- these tests never touch the real network.

function mockCloudflareFetch(handler) {
  return async (url, init) => {
    const parsed = new URL(url);
    const result = handler(parsed, init);
    return {
      json: async () => ({ success: true, errors: [], messages: [], result }),
    };
  };
}

test("RealCloudflareClient requires an apiToken and accountId", () => {
  assert.throws(() => new RealCloudflareClient({ accountId: "acct" }), /API token/);
  assert.throws(() => new RealCloudflareClient({ apiToken: "tok" }), /account id/);
});

test("RealCloudflareClient authenticates with a Bearer token and never leaks it in a thrown error", async () => {
  const secretToken = "cf-secret-token-value";
  let observedAuthHeader = null;
  const fetchImpl = async (url, init) => {
    observedAuthHeader = init.headers.Authorization;
    return { json: async () => ({ success: false, errors: [{ code: 1000, message: "Invalid API Token" }] }) };
  };
  const client = new RealCloudflareClient({ apiToken: secretToken, accountId: "acct-id", fetchImpl });
  await assert.rejects(() => client.getDnsRecord("curations.dev"), CloudflareApiError);
  assert.equal(observedAuthHeader, `Bearer ${secretToken}`);

  let caughtMessage = "";
  try {
    await client.getDnsRecord("curations.dev");
  } catch (err) {
    caughtMessage = err.message;
  }
  assert.ok(!caughtMessage.includes(secretToken), "the API token must never appear in a thrown error message");
});

test("RealCloudflareClient.getDnsRecord resolves the zone once and queries dns_records by name", async () => {
  const calls = [];
  const fetchImpl = mockCloudflareFetch((url) => {
    calls.push(url.pathname + url.search);
    if (url.pathname === "/client/v4/zones") return [{ id: "zone-123", name: "curations.dev" }];
    if (url.pathname === "/client/v4/zones/zone-123/dns_records") {
      return [{ id: "rec-1", type: "CNAME", name: "www.curations.dev", content: "curations-dev.pages.dev", proxied: true }];
    }
    return [];
  });
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl });
  const record = await client.getDnsRecord("www.curations.dev");
  assert.equal(record.content, "curations-dev.pages.dev");
  assert.equal(record.type, "CNAME");
  assert.ok(calls.some((c) => c.startsWith("/client/v4/zones?")));
  assert.ok(calls.some((c) => c.includes("/dns_records?name=www.curations.dev")));

  // Second call must reuse the cached zone id (no repeat zone lookup).
  calls.length = 0;
  await client.getDnsRecord("www.curations.dev");
  assert.ok(!calls.some((c) => c.startsWith("/client/v4/zones?")), "zone id must be cached, not re-resolved");
});

test("RealCloudflareClient.getDnsRecord returns null when Cloudflare has no matching record", async () => {
  const fetchImpl = mockCloudflareFetch((url) => {
    if (url.pathname === "/client/v4/zones") return [{ id: "zone-123" }];
    return [];
  });
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl });
  assert.equal(await client.getDnsRecord("nothing.curations.dev"), null);
});

test("RealCloudflareClient.upsertDnsRecord creates when no record exists and updates when one does", async () => {
  const methodsByPath = [];
  let existing = null;
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    methodsByPath.push(`${init.method} ${parsed.pathname}`);
    if (parsed.pathname === "/client/v4/zones") {
      return { json: async () => ({ success: true, result: [{ id: "zone-123" }] }) };
    }
    if (parsed.pathname === "/client/v4/zones/zone-123/dns_records" && init.method === "GET") {
      return { json: async () => ({ success: true, result: existing ? [existing] : [] }) };
    }
    if (parsed.pathname === "/client/v4/zones/zone-123/dns_records" && init.method === "POST") {
      existing = { id: "rec-new", ...JSON.parse(init.body) };
      return { json: async () => ({ success: true, result: existing }) };
    }
    if (parsed.pathname.startsWith("/client/v4/zones/zone-123/dns_records/") && init.method === "PUT") {
      existing = { ...existing, ...JSON.parse(init.body) };
      return { json: async () => ({ success: true, result: existing }) };
    }
    throw new Error(`unexpected request: ${init.method} ${parsed.pathname}`);
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl });

  const created = await client.upsertDnsRecord("api.curations.dev", { content: "gateway.example", proxied: false, type: "CNAME" });
  assert.equal(created.content, "gateway.example");
  assert.ok(methodsByPath.some((m) => m.startsWith("POST ")));

  const updated = await client.upsertDnsRecord("api.curations.dev", { content: "new-gateway.example", proxied: false, type: "CNAME" });
  assert.equal(updated.content, "new-gateway.example");
  assert.ok(methodsByPath.some((m) => m.startsWith("PUT ")));
});

test("RealCloudflareClient.deleteDnsRecord is a no-op when no record exists, and DELETEs when one does", async () => {
  const methodCalls = [];
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    methodCalls.push(`${init.method} ${parsed.pathname}`);
    if (parsed.pathname === "/client/v4/zones") return { json: async () => ({ success: true, result: [{ id: "zone-123" }] }) };
    if (parsed.pathname === "/client/v4/zones/zone-123/dns_records") {
      return { json: async () => ({ success: true, result: [{ id: "rec-1", type: "CNAME", name: "api.curations.dev", content: "x" }] }) };
    }
    return { json: async () => ({ success: true, result: {} }) };
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl });
  await client.deleteDnsRecord("api.curations.dev");
  assert.ok(methodCalls.some((m) => m === "DELETE /client/v4/zones/zone-123/dns_records/rec-1"));
});

test("RealCloudflareClient's Worker Custom Domain methods never call a Worker-script-delete or Pages-project-delete endpoint", async () => {
  const paths = [];
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    paths.push(`${init.method} ${parsed.pathname}`);
    if (parsed.pathname === "/client/v4/accounts/acct-1/workers/domains" && init.method === "GET") {
      return {
        json: async () => ({
          success: true,
          result: [{ id: "wd-1", hostname: "api.curations.dev", service: "svc", environment: "production", zone_id: "zone-123" }],
        }),
      };
    }
    return { json: async () => ({ success: true, result: {} }) };
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "acct-1", fetchImpl });

  const domain = await client.getWorkerCustomDomain("api.curations.dev");
  assert.equal(domain.hostname, "api.curations.dev");

  await client.removeWorkerCustomDomain("api.curations.dev");
  assert.ok(paths.includes("DELETE /client/v4/accounts/acct-1/workers/domains/wd-1"));

  assert.ok(!paths.some((p) => p.includes("/scripts/")), "must never call a Worker scripts endpoint");
  assert.ok(!paths.some((p) => p.includes("/pages/")), "must never call a Pages endpoint");
});

test("RealCloudflareClient.attachWorkerCustomDomain PUTs hostname/service/environment/zone_id", async () => {
  let capturedBody = null;
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/client/v4/accounts/acct-1/workers/domains" && init.method === "PUT") {
      capturedBody = JSON.parse(init.body);
      return {
        json: async () => ({
          success: true,
          result: { id: "wd-2", hostname: capturedBody.hostname, service: capturedBody.service, environment: capturedBody.environment, zone_id: capturedBody.zone_id },
        }),
      };
    }
    throw new Error(`unexpected request: ${init.method} ${parsed.pathname}`);
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "acct-1", fetchImpl });
  const result = await client.attachWorkerCustomDomain("api.curations.dev", {
    service: "yolo-gateway-worker",
    environment: "production",
    zoneId: "zone-123",
  });
  assert.deepEqual(capturedBody, {
    hostname: "api.curations.dev",
    service: "yolo-gateway-worker",
    environment: "production",
    zone_id: "zone-123",
  });
  assert.equal(result.zoneId, "zone-123");
});

test("RealCloudflareClient surfaces Cloudflare's real error shape without crashing", async () => {
  const fetchImpl = async () => ({
    json: async () => ({ success: false, errors: [{ code: 1000, message: "Invalid API Token" }] }),
  });
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl });
  await assert.rejects(() => client.getDnsRecord("curations.dev"), /Invalid API Token/);
});

test("RealCloudflareClient does not implement SWA hostname validation (Azure, not Cloudflare, concern)", async () => {
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl: async () => ({ json: async () => ({ success: true, result: [] }) }) });
  await assert.rejects(() => client.requestSwaHostnameValidation("curations.dev"), /Azure Static Web Apps/);
  await assert.rejects(() => client.getSwaHostnameStatus("curations.dev"), /Azure Static Web Apps/);
});

