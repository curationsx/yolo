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
  RealAzureSwaHostnameClient,
  RealAzureGatewayClient,
  ComposedRealClient,
  extractSwaValidationTokenValue,
  CloudflareApiError,
  loadCloudflareClient,
  computeCutoverPlan,
  runCutover,
  runRollback,
  swaValidationRecordName,
  asuidRecordName,
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

test("computeCutoverPlan prevalidates SWA hostnames first, verifies asuid before cut-api, cuts API, binds the hostname, then root, then www, then gates on the manual default-domain step", () => {
  const plan = computeCutoverPlan({
    hostnames: HOSTNAMES,
    azureTargets: { apiHostname: "gw.example", staticWebAppHostname: "site.example", apiCertificateName: "fixture-cert" },
  });
  assert.deepEqual(plan.map((s) => s.name), [
    "validate-swa-root",
    "validate-swa-www",
    "verify-asuid-api",
    "cut-api",
    "bind-api-hostname",
    "cut-root",
    "cut-www",
    "set-default-domain",
  ]);
  assert.equal(plan[0].kind, "validate");
  assert.equal(plan[2].kind, "asuid-verify");
  assert.equal(plan[3].kind, "cut");
  assert.equal(plan[4].kind, "bind");
  assert.equal(plan[4].certificateName, "fixture-cert");
  assert.equal(plan[7].kind, "manual-gate");
  assert.equal(plan[7].name, SET_DEFAULT_DOMAIN_STEP);
  assert.match(plan[7].instructions, /verify\.mjs/);
  assert.match(plan[7].instructions, /--check-www-redirect/);
});

test("swaValidationRecordName computes _dnsauth.<hostname> for both apex and subdomain hostnames", () => {
  assert.equal(swaValidationRecordName("curations.dev"), "_dnsauth.curations.dev");
  assert.equal(swaValidationRecordName("www.curations.dev"), "_dnsauth.www.curations.dev");
});

test("asuidRecordName computes asuid.<hostname> for the API hostname", () => {
  assert.equal(asuidRecordName("api.curations.dev"), "asuid.api.curations.dev");
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

test("runCutover resumes past an SWA hostname that Azure already reports Ready without requiring its retired token", async () => {
  const fixture = freshZoneFixture("swa-already-ready.json");
  const state = JSON.parse(fs.readFileSync(fixture, "utf8"));
  state.swaHostnames = {
    "curations.dev": {
      status: "Ready",
      validationToken: null,
      txtRecordName: "_dnsauth.curations.dev",
    },
  };
  fs.writeFileSync(fixture, `${JSON.stringify(state, null, 2)}\n`);

  const client = new FixtureCloudflareClient(fixture);
  const originalRequest = client.requestSwaHostnameValidation.bind(client);
  client.requestSwaHostnameValidation = async (hostname) => {
    if (hostname === "curations.dev") {
      throw new Error("already-ready apex must not request a retired validation token");
    }
    return originalRequest(hostname);
  };

  const report = await runCutover(
    {
      hostnames: HOSTNAMES,
      acceptancePath: ACCEPTANCE_READY,
      apply: true,
      confirm: PRODUCTION_CONFIRM_PHRASE,
      manifestDir: path.join(SCRATCH, "manifests-swa-already-ready"),
      confirmedManualSteps: [SET_DEFAULT_DOMAIN_STEP],
    },
    { client }
  );

  assert.equal(report.applied, true);
});

test("runCutover retriggers Azure validation only after publishing each SWA TXT record", async () => {
  const fixture = freshZoneFixture("swa-retrigger.json");
  const client = new FixtureCloudflareClient(fixture);
  const events = [];
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (hostname, options) => {
    if (hostname.startsWith("_dnsauth.")) events.push(`txt:${hostname}`);
    return originalUpsert(hostname, options);
  };
  client.triggerSwaHostnameValidation = async (hostname) => {
    events.push(`trigger:${hostname}`);
  };

  await runCutover(
    {
      hostnames: HOSTNAMES,
      acceptancePath: ACCEPTANCE_READY,
      apply: true,
      confirm: PRODUCTION_CONFIRM_PHRASE,
      manifestDir: path.join(SCRATCH, "manifests-swa-retrigger"),
      confirmedManualSteps: [SET_DEFAULT_DOMAIN_STEP],
    },
    { client }
  );

  assert.deepEqual(events.slice(0, 4), [
    "txt:_dnsauth.curations.dev",
    "trigger:curations.dev",
    "txt:_dnsauth.www.curations.dev",
    "trigger:www.curations.dev",
  ]);
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
      stagingApiCertificateName: "fixture-cert",
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
    "validate-swa-root,validate-swa-www,verify-asuid-api,cut-api,bind-api-hostname,cut-root,cut-www,set-default-domain"
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

  // The asuid.api.curations.dev TXT record must be published (additively,
  // before the Worker Custom Domain was ever touched) with the gateway's
  // customDomainVerificationId, and the hostname+certificate bind must
  // have completed afterward.
  assert.equal(finalState.records["asuid.api.curations.dev"].type, "TXT");
  assert.equal(finalState.records["asuid.api.curations.dev"].content, finalState.gatewayVerificationId);
  assert.equal(finalState.apiHostnameBinding.hostname, "api.curations.dev");
  assert.equal(finalState.apiHostnameBinding.certificateName, "fixture-cert-api-curations-dev");

  assert.ok(fs.existsSync(report.manifestPath), "rollback manifest must be written to disk");
  const manifest = JSON.parse(fs.readFileSync(report.manifestPath, "utf8"));
  assert.equal(manifest.status, "complete");
  assert.equal(manifest.snapshot.root.content, "curations-dev.pages.dev");
  assert.equal(manifest.snapshot.api.type, "AAAA", "the pre-cutover snapshot must capture Cloudflare's managed AAAA record");
  assert.equal(manifest.plan[0].kind, "validate");
  assert.equal(manifest.plan[2].kind, "asuid-verify");
  assert.equal(manifest.plan[2].name, "verify-asuid-api");
  assert.equal(manifest.plan[4].kind, "bind");
  assert.equal(manifest.plan[4].name, "bind-api-hostname");
  assert.equal(manifest.plan[7].kind, "manual-gate");
  assert.equal(manifest.plan[7].name, SET_DEFAULT_DOMAIN_STEP);
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

// --- asuid.api verification: must happen before Worker detachment --------

test("verify-asuid-api publishes the asuid.api.curations.dev TXT record with the gateway's customDomainVerificationId, strictly BEFORE the Worker Custom Domain is ever touched", async () => {
  const fixture = freshZoneFixture("asuid-ordering.json");
  const client = new FixtureCloudflareClient(fixture);
  const calls = [];
  const originalGetVerificationId = client.getCustomDomainVerificationId.bind(client);
  client.getCustomDomainVerificationId = async () => {
    calls.push("getCustomDomainVerificationId");
    return originalGetVerificationId();
  };
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (hostname, opts) => {
    if (hostname === asuidRecordName("api.curations.dev")) calls.push("upsertDnsRecord:asuid");
    return originalUpsert(hostname, opts);
  };
  const originalRemove = client.removeWorkerCustomDomain.bind(client);
  client.removeWorkerCustomDomain = async (hostname) => {
    calls.push("removeWorkerCustomDomain");
    return originalRemove(hostname);
  };

  const manifestDir = path.join(SCRATCH, "manifests-asuid-ordering");
  await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );

  const verificationIdIndex = calls.indexOf("getCustomDomainVerificationId");
  const upsertAsuidIndex = calls.indexOf("upsertDnsRecord:asuid");
  const removeWorkerIndex = calls.indexOf("removeWorkerCustomDomain");
  assert.ok(verificationIdIndex !== -1, "getCustomDomainVerificationId must be called");
  assert.ok(upsertAsuidIndex !== -1, "the asuid TXT record must be upserted");
  assert.ok(removeWorkerIndex !== -1, "the Worker Custom Domain must be detached");
  assert.ok(
    verificationIdIndex < removeWorkerIndex && upsertAsuidIndex < removeWorkerIndex,
    "both reading the verification ID and publishing the asuid TXT record must happen before Worker detachment"
  );

  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.records["asuid.api.curations.dev"].content, finalState.gatewayVerificationId);
  assert.equal(finalState.records["asuid.api.curations.dev"].type, "TXT");
});

test("bind-api-hostname only runs (and only can succeed) after cut-api's CNAME already exists", async () => {
  const fixture = freshZoneFixture("bind-after-cnam.json");
  const client = new FixtureCloudflareClient(fixture);
  const calls = [];
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (hostname, opts) => {
    if (hostname === "api.curations.dev" && opts.type === "CNAME") calls.push("cnameCreated");
    return originalUpsert(hostname, opts);
  };
  const originalBind = client.bindApiHostname.bind(client);
  client.bindApiHostname = async (hostname, certificateName) => {
    calls.push("bindApiHostname");
    return originalBind(hostname, certificateName);
  };

  const manifestDir = path.join(SCRATCH, "manifests-bind-after-cname");
  const report = await runCutover(
    { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
    { client }
  );

  assert.deepEqual(calls, ["cnameCreated", "bindApiHostname"], "the CNAME must be created before the hostname+certificate bind is attempted");
  const bindStep = report.steps.find((s) => s.name === "bind-api-hostname");
  assert.ok(bindStep.verification.ok, "bind-api-hostname must be independently verified, not just assumed from cut-api's success");
  assert.equal(bindStep.verification.status, "Bound");
});

// --- Rollback: asuid.api TXT record prior-state handling ------------------

test("runRollback removes the asuid.api.curations.dev TXT record entirely when it had no prior content (the typical case)", async () => {
  const fixture = freshZoneFixture("rollback-asuid-no-prior.json");
  const client = new FixtureCloudflareClient(fixture);
  const manifestDir = path.join(SCRATCH, "manifests-rollback-asuid-no-prior");
  await runCutover(
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
  const manifestPath = fs.readdirSync(manifestDir).map((f) => path.join(manifestDir, f)).find((p) => p.includes("cutover"));
  assert.ok(manifestPath, "a cutover manifest must have been written");
  assert.equal(
    JSON.parse(fs.readFileSync(manifestPath, "utf8")).snapshot.asuidApi,
    null,
    "the pre-cutover snapshot must record that asuid.api.curations.dev did not exist yet"
  );

  await runRollback({ manifestPath, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE }, { client });

  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.records["asuid.api.curations.dev"], undefined, "rollback must delete the asuid TXT record this tool itself created");
});

test("runRollback restores the asuid.api.curations.dev TXT record's prior content when one already existed before cutover", async () => {
  const zoneWithPriorAsuid = path.join(SCRATCH, `zone-prior-asuid-${process.pid}.json`);
  const seed = JSON.parse(fs.readFileSync(ZONE_FIXTURE, "utf8"));
  seed.records["asuid.api.curations.dev"] = {
    id: "rec-asuid-preexisting",
    type: "TXT",
    name: "asuid.api.curations.dev",
    content: "pre-existing-unrelated-verification-id",
    proxied: false,
  };
  fs.writeFileSync(zoneWithPriorAsuid, JSON.stringify(seed));
  const client = new FixtureCloudflareClient(zoneWithPriorAsuid);
  const manifestDir = path.join(SCRATCH, "manifests-rollback-asuid-prior");
  await runCutover(
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
  const manifestPath = fs.readdirSync(manifestDir).map((f) => path.join(manifestDir, f)).find((p) => p.includes("cutover"));
  const priorSnapshot = JSON.parse(fs.readFileSync(manifestPath, "utf8")).snapshot.asuidApi;
  assert.equal(priorSnapshot.content, "pre-existing-unrelated-verification-id");

  await runRollback({ manifestPath, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE }, { client });

  const finalState = JSON.parse(fs.readFileSync(zoneWithPriorAsuid, "utf8"));
  assert.equal(
    finalState.records["asuid.api.curations.dev"].content,
    "pre-existing-unrelated-verification-id",
    "rollback must restore the exact prior content, not just delete it, when the record already existed before cutover"
  );
});

// --- RealAzureGatewayClient: `az containerapp show`/`hostname bind`/`hostname list`-backed gateway operations ---

/** Fake execFileImpl matching promisify(child_process.execFile)'s shape,
 * dispatching on the `az containerapp` subcommand. */
function fakeAzGatewayExecFile({ onShow, onBind, onHostnameList } = {}) {
  return async (cmd, args) => {
    assert.equal(cmd, "az");
    assert.equal(args[0], "containerapp");
    if (args[1] === "show") {
      const result = onShow ? await onShow(args) : "";
      return { stdout: result, stderr: "" };
    }
    if (args[1] === "hostname" && args[2] === "bind") {
      if (onBind) await onBind(args);
      return { stdout: "", stderr: "" };
    }
    if (args[1] === "hostname" && args[2] === "list") {
      const result = onHostnameList ? await onHostnameList(args) : [];
      return { stdout: JSON.stringify(result), stderr: "" };
    }
    throw new Error(`fakeAzGatewayExecFile: unexpected invocation: ${cmd} ${args.join(" ")}`);
  };
}

test("RealAzureGatewayClient.getCustomDomainVerificationId reads only properties.customDomainVerificationId via --query, never the full resource", async () => {
  let showArgs = null;
  const execFileImpl = fakeAzGatewayExecFile({
    onShow: (args) => {
      showArgs = args;
      return "11111111-2222-3333-4444-555555555555\n";
    },
  });
  const client = new RealAzureGatewayClient({ appName: "ca-yolo-gateway", resourceGroup: "rg-yolo-prod", execFileImpl });
  const verificationId = await client.getCustomDomainVerificationId();
  assert.equal(verificationId, "11111111-2222-3333-4444-555555555555");
  assert.ok(showArgs.includes("--query"));
  const queryIndex = showArgs.indexOf("--query");
  assert.equal(showArgs[queryIndex + 1], "properties.customDomainVerificationId", "must query only the single non-secret field it needs");
  assert.ok(showArgs.includes("ca-yolo-gateway"));
  assert.ok(showArgs.includes("rg-yolo-prod"));
});

test("RealAzureGatewayClient.getCustomDomainVerificationId throws a clear error on an empty result", async () => {
  const execFileImpl = fakeAzGatewayExecFile({ onShow: () => "\n" });
  const client = new RealAzureGatewayClient({ execFileImpl });
  await assert.rejects(() => client.getCustomDomainVerificationId(), /empty customDomainVerificationId/);
});

test("RealAzureGatewayClient.bindApiHostname passes --hostname and --certificate through to 'az containerapp hostname bind'", async () => {
  let bindArgs = null;
  const execFileImpl = fakeAzGatewayExecFile({
    onBind: (args) => {
      bindArgs = args;
    },
  });
  const client = new RealAzureGatewayClient({
    appName: "ca-yolo-gateway",
    resourceGroup: "rg-yolo-prod",
    environment: "cae-yolo-prod",
    execFileImpl,
  });
  await client.bindApiHostname("api.curations.dev", "cert-api-curations-dev-20260101t000000z");
  assert.ok(bindArgs.includes("--hostname"));
  assert.equal(bindArgs[bindArgs.indexOf("--hostname") + 1], "api.curations.dev");
  assert.ok(bindArgs.includes("--certificate"));
  assert.equal(bindArgs[bindArgs.indexOf("--certificate") + 1], "cert-api-curations-dev-20260101t000000z");
  assert.ok(bindArgs.includes("--environment"));
  assert.equal(bindArgs[bindArgs.indexOf("--environment") + 1], "cae-yolo-prod");
});

test("RealAzureGatewayClient.bindApiHostname refuses without a certificateName", async () => {
  const client = new RealAzureGatewayClient({ execFileImpl: fakeAzGatewayExecFile() });
  await assert.rejects(() => client.bindApiHostname("api.curations.dev", ""), /requires a certificateName/);
});

test("RealAzureGatewayClient.getApiHostnameBindingStatus reports 'NotBound' when the hostname is absent or disabled, 'Bound' once a real bindingType is present", async () => {
  const notFoundExecFile = fakeAzGatewayExecFile({ onHostnameList: () => [] });
  const notFoundClient = new RealAzureGatewayClient({ execFileImpl: notFoundExecFile });
  assert.equal(await notFoundClient.getApiHostnameBindingStatus("api.curations.dev"), "NotBound");

  const disabledExecFile = fakeAzGatewayExecFile({
    onHostnameList: () => [{ name: "api.curations.dev", bindingType: "Disabled" }],
  });
  const disabledClient = new RealAzureGatewayClient({ execFileImpl: disabledExecFile });
  assert.equal(await disabledClient.getApiHostnameBindingStatus("api.curations.dev"), "NotBound");

  const boundExecFile = fakeAzGatewayExecFile({
    onHostnameList: () => [{ name: "api.curations.dev", bindingType: "SniEnabled" }],
  });
  const boundClient = new RealAzureGatewayClient({ execFileImpl: boundExecFile });
  assert.equal(await boundClient.getApiHostnameBindingStatus("api.curations.dev"), "Bound");
});

test("ComposedRealClient routes gateway-concern methods (verification id, hostname bind, binding status) to the gateway client", async () => {
  const gatewayCalls = [];
  const gatewayClient = {
    getCustomDomainVerificationId: async () => {
      gatewayCalls.push("getCustomDomainVerificationId");
      return "fixture-verification-id";
    },
    bindApiHostname: async (hostname, certificateName) => {
      gatewayCalls.push(`bindApiHostname:${hostname}:${certificateName}`);
    },
    getApiHostnameBindingStatus: async (hostname) => {
      gatewayCalls.push(`getApiHostnameBindingStatus:${hostname}`);
      return "Bound";
    },
  };
  const composed = new ComposedRealClient({}, {}, gatewayClient);
  assert.equal(await composed.getCustomDomainVerificationId(), "fixture-verification-id");
  await composed.bindApiHostname("api.curations.dev", "cert-name");
  assert.equal(await composed.getApiHostnameBindingStatus("api.curations.dev"), "Bound");
  assert.deepEqual(gatewayCalls, [
    "getCustomDomainVerificationId",
    "bindApiHostname:api.curations.dev:cert-name",
    "getApiHostnameBindingStatus:api.curations.dev",
  ]);
});

test("loadCloudflareClient in real mode also wires a RealAzureGatewayClient, overridable via YOLO_GATEWAY_APP/YOLO_CONTAINERAPPS_ENV", () => {
  const defaultClient = loadCloudflareClient({}, { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" });
  assert.ok(defaultClient.gatewayClient instanceof RealAzureGatewayClient);
  assert.equal(defaultClient.gatewayClient.appName, "ca-yolo-gateway");
  assert.equal(defaultClient.gatewayClient.resourceGroup, "rg-yolo-prod");
  assert.equal(defaultClient.gatewayClient.environment, "cae-yolo-prod");

  const overriddenClient = loadCloudflareClient(
    {},
    {
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_ACCOUNT_ID: "a",
      YOLO_GATEWAY_APP: "ca-custom-gateway",
      YOLO_RESOURCE_GROUP: "rg-custom",
      YOLO_CONTAINERAPPS_ENV: "cae-custom",
    }
  );
  assert.equal(overriddenClient.gatewayClient.appName, "ca-custom-gateway");
  assert.equal(overriddenClient.gatewayClient.resourceGroup, "rg-custom");
  assert.equal(overriddenClient.gatewayClient.environment, "cae-custom");
});

// --- Acceptance schema: apiCertificateName is required --------------------

test("loadAcceptance refuses when apiCertificateName is missing", () => {
  const acceptanceMissingCertName = path.join(SCRATCH, "acceptance-missing-cert-name.json");
  fs.writeFileSync(
    acceptanceMissingCertName,
    JSON.stringify({
      apiHostname: "ca-yolo-gateway.example.eastus2.azurecontainerapps.io",
      staticWebAppHostname: "stapp-yolo-prod.azurestaticapps.net",
      tempCertReady: true,
    })
  );
  assert.throws(() => loadAcceptance(acceptanceMissingCertName), /apiCertificateName/);
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
  const originalGetDnsRecord = client.getDnsRecord.bind(client);
  client.getDnsRecord = async (hostname) => {
    if (hostname === "api.curations.dev") {
      return { id: "rec-managed-aaaa-api", type: "AAAA", name: hostname, content: "100::", proxied: true, managedByWorker: true };
    }
    // Every other hostname (including asuid.api.curations.dev, the
    // verify-asuid-api step's record) keeps the real fixture behavior, so
    // that unrelated step still passes cleanly and only cut-api's own
    // managed-AAAA-never-clears scenario is exercised.
    return originalGetDnsRecord(hostname);
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
    4,
    "must verify both SWA prevalidation steps, verify-asuid-api, and cut-api, but must not proceed to bind-api-hostname/cut-root/cut-www after cut-api verification fails"
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

test("loadCloudflareClient falls back to a real (composed) client when both env vars are present and no --fixture is given", () => {
  const client = loadCloudflareClient({}, { CLOUDFLARE_API_TOKEN: "fake-token", CLOUDFLARE_ACCOUNT_ID: "fake-account" });
  assert.ok(client instanceof ComposedRealClient);
  assert.ok(client.cloudflareClient instanceof RealCloudflareClient);
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

test("RealCloudflareClient accepts an empty successful response after detaching a Worker Custom Domain", async () => {
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/client/v4/accounts/acct-1/workers/domains" && init.method === "GET") {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          result: [{ id: "wd-1", hostname: "api.curations.dev", service: "svc", environment: "production" }],
        }),
      };
    }
    if (parsed.pathname === "/client/v4/accounts/acct-1/workers/domains/wd-1" && init.method === "DELETE") {
      return {
        status: 200,
        ok: true,
        json: async () => {
          throw new SyntaxError("empty response body");
        },
      };
    }
    throw new Error(`unexpected request: ${init.method} ${parsed.pathname}`);
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "acct-1", fetchImpl });
  await assert.doesNotReject(() => client.removeWorkerCustomDomain("api.curations.dev"));
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

test("RealCloudflareClient no longer implements SWA hostname validation at all (Azure, not Cloudflare, concern -- see RealAzureSwaHostnameClient)", async () => {
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "a", fetchImpl: async () => ({ json: async () => ({ success: true, result: [] }) }) });
  assert.equal(typeof client.requestSwaHostnameValidation, "undefined");
  assert.equal(typeof client.getSwaHostnameStatus, "undefined");
});

// --- RealAzureSwaHostnameClient: `az staticwebapp hostname set/show`-backed SWA validation ---

/** Builds a fake `execFileImpl` matching promisify(child_process.execFile)'s
 * shape ({ stdout, stderr }), dispatching on the `az` subcommand
 * (`hostname set` vs `hostname show`) the same way the fixture `az`
 * binary used by the bash test harness dispatches on argv. */
function fakeAzExecFile({ onSet, onShow } = {}) {
  return async (cmd, args) => {
    assert.equal(cmd, "az");
    if (args[0] === "staticwebapp" && args[1] === "hostname" && args[2] === "set") {
      if (onSet) await onSet(args);
      return { stdout: "", stderr: "" };
    }
    if (args[0] === "staticwebapp" && args[1] === "hostname" && args[2] === "show") {
      const result = onShow ? await onShow(args) : null;
      if (result === null) {
        const err = new Error("ResourceNotFound: hostname not found");
        err.code = 3;
        throw err;
      }
      return { stdout: JSON.stringify(result), stderr: "" };
    }
    throw new Error(`fakeAzExecFile: unexpected invocation: ${cmd} ${args.join(" ")}`);
  };
}

test("extractSwaValidationTokenValue returns a bare token unchanged", () => {
  assert.equal(extractSwaValidationTokenValue("bare-token-value"), "bare-token-value");
});

test("extractSwaValidationTokenValue extracts the value out of a zone-file-style TXT record line", () => {
  assert.equal(
    extractSwaValidationTokenValue('_dnsauth.curations.dev. IN TXT "the-real-token-value"'),
    "the-real-token-value"
  );
  assert.equal(extractSwaValidationTokenValue("_dnsauth.curations.dev. IN TXT the-real-token-value"), "the-real-token-value");
});

test("extractSwaValidationTokenValue passes through a non-string input unchanged", () => {
  assert.equal(extractSwaValidationTokenValue(undefined), undefined);
});

test("RealAzureSwaHostnameClient.requestSwaHostnameValidation calls 'hostname set --no-wait' then reads the token from 'hostname show'", async () => {
  let setArgs = null;
  const execFileImpl = fakeAzExecFile({
    onSet: (args) => {
      setArgs = args;
    },
    onShow: () => ({ status: "Validating", validationToken: "raw-token-123" }),
  });
  const client = new RealAzureSwaHostnameClient({
    staticWebAppName: "stapp-yolo-prod",
    resourceGroup: "rg-yolo-prod",
    execFileImpl,
  });
  const result = await client.requestSwaHostnameValidation("curations.dev");
  assert.deepEqual(result, { validationToken: "raw-token-123", txtRecordName: "_dnsauth.curations.dev" });

  assert.ok(setArgs.includes("--no-wait"), "requestSwaHostnameValidation must pass --no-wait");
  assert.ok(setArgs.includes("--validation-method"), "requestSwaHostnameValidation must set --validation-method");
  const methodIndex = setArgs.indexOf("--validation-method");
  assert.equal(setArgs[methodIndex + 1], "dns-txt-token");
  assert.ok(setArgs.includes("stapp-yolo-prod"));
  assert.ok(setArgs.includes("rg-yolo-prod"));
  assert.ok(setArgs.includes("curations.dev"));
});

test("RealAzureSwaHostnameClient.requestSwaHostnameValidation extracts the token value from a zone-file-style validationToken", async () => {
  const execFileImpl = fakeAzExecFile({
    onShow: () => ({ status: "Validating", validationToken: '_dnsauth.curations.dev. IN TXT "extracted-value"' }),
  });
  const client = new RealAzureSwaHostnameClient({ execFileImpl });
  const result = await client.requestSwaHostnameValidation("curations.dev");
  assert.equal(result.validationToken, "extracted-value");
});

test("RealAzureSwaHostnameClient.requestSwaHostnameValidation throws a clear error when Azure has not yet returned a token", async () => {
  const execFileImpl = fakeAzExecFile({ onShow: () => ({ status: "Validating", validationToken: null }) });
  const client = new RealAzureSwaHostnameClient({ execFileImpl });
  await assert.rejects(() => client.requestSwaHostnameValidation("curations.dev"), /has not yet returned a dns-txt-token validation token/);
});

test("RealAzureSwaHostnameClient.getSwaHostnameStatus reports 'NotRequested' before any 'hostname set' call", async () => {
  const execFileImpl = fakeAzExecFile({ onShow: () => null });
  const client = new RealAzureSwaHostnameClient({ execFileImpl });
  assert.equal(await client.getSwaHostnameStatus("curations.dev"), "NotRequested");
});

test("RealAzureSwaHostnameClient.getSwaHostnameStatus reports Azure's real status once known, including 'Ready'", async () => {
  const execFileImpl = fakeAzExecFile({ onShow: () => ({ status: "Ready", validationToken: "tok" }) });
  const client = new RealAzureSwaHostnameClient({ execFileImpl });
  assert.equal(await client.getSwaHostnameStatus("curations.dev"), "Ready");
});

test("RealAzureSwaHostnameClient never logs or throws with the validation token value in any error message it raises itself", async () => {
  // The dns-txt-token value is not a secret (it is designed to be
  // published as a public DNS TXT record), but this client must still
  // never gratuitously embed it in any thrown error text -- the only
  // place it should ever surface is the returned { validationToken }
  // object, handed directly to the existing Cloudflare TXT-record path.
  const execFileImpl = fakeAzExecFile({ onShow: () => ({ status: "Validating", validationToken: null }) });
  const client = new RealAzureSwaHostnameClient({ execFileImpl });
  try {
    await client.requestSwaHostnameValidation("curations.dev");
    assert.fail("expected requestSwaHostnameValidation to throw");
  } catch (err) {
    assert.doesNotMatch(err.message, /raw-token|extracted-value|tok\b/);
  }
});

// --- ComposedRealClient: RealCloudflareClient + RealAzureSwaHostnameClient ---

test("ComposedRealClient routes Cloudflare-concern methods to the Cloudflare client and SWA-concern methods to the SWA client", async () => {
  const cloudflareCalls = [];
  const swaCalls = [];
  const cloudflareClient = {
    preflight: async () => {
      cloudflareCalls.push("preflight");
      return { ok: true };
    },
    getDnsRecord: async (h) => {
      cloudflareCalls.push(`getDnsRecord:${h}`);
      return null;
    },
    upsertDnsRecord: async (h, opts) => {
      cloudflareCalls.push(`upsertDnsRecord:${h}:${opts.type}`);
      return { ...opts };
    },
    deleteDnsRecord: async (h) => {
      cloudflareCalls.push(`deleteDnsRecord:${h}`);
    },
    getWorkerCustomDomain: async (h) => {
      cloudflareCalls.push(`getWorkerCustomDomain:${h}`);
      return null;
    },
    removeWorkerCustomDomain: async (h) => {
      cloudflareCalls.push(`removeWorkerCustomDomain:${h}`);
    },
    attachWorkerCustomDomain: async (h, opts) => {
      cloudflareCalls.push(`attachWorkerCustomDomain:${h}:${opts.service}`);
    },
  };
  const swaClient = {
    requestSwaHostnameValidation: async (h) => {
      swaCalls.push(`requestSwaHostnameValidation:${h}`);
      return { validationToken: "tok", txtRecordName: `_dnsauth.${h}` };
    },
    triggerSwaHostnameValidation: async (h) => {
      swaCalls.push(`triggerSwaHostnameValidation:${h}`);
    },
    getSwaHostnameStatus: async (h) => {
      swaCalls.push(`getSwaHostnameStatus:${h}`);
      return "Ready";
    },
  };
  const composed = new ComposedRealClient(cloudflareClient, swaClient);

  await composed.preflight();
  await composed.getDnsRecord("api.curations.dev");
  await composed.upsertDnsRecord("api.curations.dev", { content: "x", type: "CNAME" });
  await composed.deleteDnsRecord("api.curations.dev");
  await composed.getWorkerCustomDomain("api.curations.dev");
  await composed.removeWorkerCustomDomain("api.curations.dev");
  await composed.attachWorkerCustomDomain("api.curations.dev", { service: "svc", environment: "production", zoneId: "z" });
  const swaResult = await composed.requestSwaHostnameValidation("curations.dev");
  await composed.triggerSwaHostnameValidation("curations.dev");
  const status = await composed.getSwaHostnameStatus("curations.dev");

  assert.deepEqual(cloudflareCalls, [
    "preflight",
    "getDnsRecord:api.curations.dev",
    "upsertDnsRecord:api.curations.dev:CNAME",
    "deleteDnsRecord:api.curations.dev",
    "getWorkerCustomDomain:api.curations.dev",
    "removeWorkerCustomDomain:api.curations.dev",
    "attachWorkerCustomDomain:api.curations.dev:svc",
  ]);
  assert.deepEqual(swaCalls, [
    "requestSwaHostnameValidation:curations.dev",
    "triggerSwaHostnameValidation:curations.dev",
    "getSwaHostnameStatus:curations.dev",
  ]);
  assert.deepEqual(swaResult, { validationToken: "tok", txtRecordName: "_dnsauth.curations.dev" });
  assert.equal(status, "Ready");
});

test("loadCloudflareClient in real mode returns a ComposedRealClient wired to both a RealCloudflareClient and a RealAzureSwaHostnameClient", () => {
  const client = loadCloudflareClient({}, { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" });
  assert.ok(client instanceof ComposedRealClient);
  assert.ok(client.cloudflareClient instanceof RealCloudflareClient);
  assert.ok(client.swaClient instanceof RealAzureSwaHostnameClient);
  assert.equal(client.swaClient.staticWebAppName, "stapp-yolo-prod");
  assert.equal(client.swaClient.resourceGroup, "rg-yolo-prod");
});

test("loadCloudflareClient in real mode honors YOLO_STATIC_WEB_APP/YOLO_RESOURCE_GROUP env overrides for the SWA client", () => {
  const client = loadCloudflareClient(
    {},
    {
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_ACCOUNT_ID: "a",
      YOLO_STATIC_WEB_APP: "stapp-custom",
      YOLO_RESOURCE_GROUP: "rg-custom",
    }
  );
  assert.equal(client.swaClient.staticWebAppName, "stapp-custom");
  assert.equal(client.swaClient.resourceGroup, "rg-custom");
});

// --- Cloudflare preflight: token/API access validated before any mutation ---

test("RealCloudflareClient.preflight passes when both zone and account reads succeed", async () => {
  const fetchImpl = mockCloudflareFetch((url) => {
    if (url.pathname === "/client/v4/zones") return [{ id: "zone-123" }];
    if (url.pathname === "/client/v4/accounts/acct-1/workers/domains") return [];
    throw new Error(`unexpected path: ${url.pathname}`);
  });
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "acct-1", fetchImpl });
  const result = await client.preflight();
  assert.equal(result.ok, true);
  assert.equal(result.zoneId, "zone-123");
  assert.equal(result.accountId, "acct-1");
});

test("RealCloudflareClient.preflight fails clearly (and never leaks the token) when zone access fails", async () => {
  const secretToken = "cf-secret-preflight-token";
  const fetchImpl = async () => ({ json: async () => ({ success: false, errors: [{ code: 1000, message: "Invalid API Token" }] }) });
  const client = new RealCloudflareClient({ apiToken: secretToken, accountId: "acct-1", fetchImpl });
  await assert.rejects(() => client.preflight(), /could not resolve the zone/);
  let message = "";
  try {
    await client.preflight();
  } catch (err) {
    message = err.message;
  }
  assert.ok(!message.includes(secretToken));
});

test("RealCloudflareClient.preflight fails clearly when zone access works but account access does not", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/client/v4/zones") {
      return { json: async () => ({ success: true, result: [{ id: "zone-123" }] }) };
    }
    return { json: async () => ({ success: false, errors: [{ code: 9109, message: "Missing Account:Read permission" }] }) };
  };
  const client = new RealCloudflareClient({ apiToken: "t", accountId: "acct-1", fetchImpl });
  await assert.rejects(() => client.preflight(), /could not list Workers Custom Domains/);
});

test("FixtureCloudflareClient.preflight always succeeds (fixture account is always reachable)", async () => {
  const fixture = freshZoneFixture("preflight-fixture.json");
  const client = new FixtureCloudflareClient(fixture);
  const result = await client.preflight();
  assert.equal(result.ok, true);
});

test("runCutover apply calls preflight() before the first mutation, and refuses (no partial cutover) when it fails", async () => {
  const fixture = freshZoneFixture("preflight-blocks-cutover.json");
  const client = new FixtureCloudflareClient(fixture);
  let preflightCalledAt = null;
  let firstMutationAt = null;
  let callCounter = 0;
  client.preflight = async () => {
    callCounter++;
    preflightCalledAt = callCounter;
    throw new Error("simulated preflight failure: token lacks required scope");
  };
  const originalUpsert = client.upsertDnsRecord.bind(client);
  client.upsertDnsRecord = async (...args) => {
    callCounter++;
    if (firstMutationAt === null) firstMutationAt = callCounter;
    return originalUpsert(...args);
  };

  const manifestDir = path.join(SCRATCH, "manifests-preflight-fail");
  await assert.rejects(
    () =>
      runCutover(
        { hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY, apply: true, confirm: PRODUCTION_CONFIRM_PHRASE, manifestDir },
        { client }
      ),
    /simulated preflight failure/
  );
  assert.equal(preflightCalledAt, 1, "preflight must run before any mutation attempt");
  assert.equal(firstMutationAt, null, "no mutation may be attempted when preflight fails");

  const finalState = JSON.parse(fs.readFileSync(fixture, "utf8"));
  assert.equal(finalState.records["curations.dev"].content, "curations-dev.pages.dev", "nothing must change when preflight fails");
});

test("runCutover apply proceeds normally once preflight succeeds", async () => {
  const fixture = freshZoneFixture("preflight-passes.json");
  const client = new FixtureCloudflareClient(fixture);
  let preflightCalls = 0;
  const originalPreflight = client.preflight.bind(client);
  client.preflight = async (...args) => {
    preflightCalls++;
    return originalPreflight(...args);
  };
  const manifestDir = path.join(SCRATCH, "manifests-preflight-pass");
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
  assert.equal(preflightCalls, 1);
});

test("runCutover dry run never calls preflight() (no need to touch Cloudflare beyond the read-only snapshot)", async () => {
  const fixture = freshZoneFixture("preflight-dryrun.json");
  const client = new FixtureCloudflareClient(fixture);
  let preflightCalls = 0;
  client.preflight = async () => {
    preflightCalls++;
    return { ok: true };
  };
  await runCutover({ hostnames: HOSTNAMES, acceptancePath: ACCEPTANCE_READY }, { client });
  assert.equal(preflightCalls, 0);
});
