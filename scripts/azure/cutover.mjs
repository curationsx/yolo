#!/usr/bin/env node
// scripts/azure/cutover.mjs
//
// DNS cutover + rollback tool for the CurationsX Yolo Azure migration
// (.azure/deployment-plan.md, "DNS Cutover and Rollback Tool" +
// "Domain cutover" stage). Cuts api.curations.dev first, then the apex and
// www CNAMEs, one mutation at a time, verifying after each step, and always
// writes a local (non-git) rollback manifest before it mutates anything.
//
// SWA prevalidation (runs first, before any traffic-affecting mutation):
// Azure Static Web Apps requires each custom hostname to be validated
// before traffic can be pointed at it. This tool prevalidates BOTH
// curations.dev and www.curations.dev with the `dns-txt-token` method
// (the real-mode equivalent of
// `az staticwebapp hostname set --validation-method dns-txt-token`) while
// Cloudflare is still serving production, then publishes the returned
// `_dnsauth.<hostname>` validation TXT record for each -- an *additive*
// Cloudflare DNS record that does not touch existing CNAMEs/proxying and
// therefore never affects live traffic. Only once both hostnames report
// Ready does the tool proceed to the traffic-affecting cut-api/cut-root/
// cut-www steps. Cloudflare CNAME-flattens the apex directly to the SWA
// default hostname, so no separate apex workaround is required.
//
// Certificate note: the Azure-managed certificate for api.curations.dev
// cannot issue until the gateway's default-deny IP restriction is removed
// (Stage 2/Stage 5 of the plan) -- DigiCert must be able to reach the app.
// The temporary ACME DNS-01 certificate prepared by certificate.sh is what
// bridges TLS during the cut-api step, before the IP restriction is lifted
// and the managed certificate can take over.
//
// api.curations.dev is a Cloudflare Worker Custom Domain
// (`/accounts/{account_id}/workers/domains/{domain_id}`), which
// auto-manages a proxied placeholder `AAAA 100::` DNS record -- Cloudflare
// creates/removes that record itself as the custom domain is
// attached/detached; this tool never edits it directly. The cut-api step
// therefore does NOT create the Azure CNAME immediately after detaching:
//   1. DELETE the Worker Custom Domain (detach the binding).
//   2. Confirm the managed AAAA record has actually disappeared (bounded
//      poll -- Cloudflare's removal is not necessarily instantaneous).
//   3. Only then create the DNS-only (unproxied) CNAME to the Azure
//      gateway FQDN -- creating it earlier could collide with the
//      still-present managed record.
// Rollback reverses this precisely: delete the Azure CNAME, reattach the
// Worker Custom Domain with `PUT /accounts/{account_id}/workers/domains`
// (hostname/service/environment/zone_id from the rollback manifest), then
// confirm Cloudflare has recreated the managed DNS (bounded poll) before
// declaring rollback complete. The old Cloudflare Advanced Certificate for
// api.curations.dev is NOT auto-deleted by any of this and this tool never
// deletes it either -- it must be kept intact for the full seven-day
// rollback window (plan Stage 6/7); only Stage 7 decommission, which is
// out of scope for this tool, ever removes it.
//
// Safety guarantees enforced by this tool, independent of any Cloudflare
// API behavior:
//   - Dry run is the default. No Cloudflare mutation happens without both
//     --apply and --confirm curations.dev (production) or --confirm
//     rehearse-cutover (staging rehearsal via --rehearse).
//   - Refuses outright -- in dry run AND apply -- if the required Azure
//     acceptance inputs are missing or incomplete (production mode only;
//     --rehearse relaxes this since rehearsal targets non-production
//     hostnames by definition).
//   - Every mutation is applied one at a time, verified immediately after,
//     and recorded to an on-disk manifest before moving to the next step,
//     so a crash mid-cutover always leaves a resumable/rollback-able trail.
//   - The rollback manifest is written outside git (see
//     lib/manifest-store.mjs; override with YOLO_CUTOVER_STATE_DIR).
//   - This tool NEVER calls a Cloudflare Pages-project-delete,
//     Worker-script-delete, or Advanced-Certificate-delete endpoint. It
//     only reads/writes DNS records and attaches/detaches the Worker
//     custom-domain *binding* for api.curations.dev -- the underlying
//     Worker script, Pages deployment, and TLS certificate are never
//     touched.
//
// API ASSUMPTION (needs later verification against the real Cloudflare/
// Azure accounts before production use): this tool targets the Cloudflare
// DNS records API (`/zones/:zone_id/dns_records`) and the Workers Custom
// Domains API (`/accounts/:account_id/workers/domains[/{domain_id}]`) for
// Cloudflare, and `az staticwebapp hostname set --validation-method
// dns-txt-token` / `az staticwebapp hostname show` for the SWA
// prevalidation step. Exact request/response shapes, and the exact timing
// of Cloudflare's managed-AAAA-record add/remove, should be re-verified
// against Cloudflare's and Azure's current API references and, ideally, a
// staging rehearsal, before the first production run.
//
// Two Cloudflare client modes:
//   --fixture <path>   Offline/test mode (used by scripts/azure/test/**):
//                       a local JSON file standing in for both Cloudflare
//                       zone state and Azure Static Web Apps
//                       hostname-validation state. No network access.
//   (no --fixture)     Real mode: authenticates to the real Cloudflare API
//                       using `CLOUDFLARE_API_TOKEN` and
//                       `CLOUDFLARE_ACCOUNT_ID` read from the environment
//                       (never a CLI flag, never logged). The
//                       `validate-swa-*` steps are NOT implemented in this
//                       mode (Azure SWA hostname validation is out of
//                       scope for a Cloudflare-only token) -- use
//                       --fixture for those, or --rehearse against staging
//                       hostnames, until a real Azure SWA client exists.
//                       All the same safety gates (dry run default,
//                       --apply + exact --confirm, one mutation at a time,
//                       verify-after-each, rollback manifest) still apply
//                       in real mode; nothing about them changes just
//                       because real credentials are available.
//
// Usage:
//   node scripts/azure/cutover.mjs --fixture <path> --acceptance <path>
//                        [--apply --confirm curations.dev] [--json]
//   node scripts/azure/cutover.mjs --fixture <path> --rehearse
//                        [--apply --confirm rehearse-cutover] [--json]
//   node scripts/azure/cutover.mjs --rollback <manifest-path> --fixture <path>
//                        [--apply --confirm curations.dev] [--json]
import fs from "node:fs";
import { parseArgs, CliArgError } from "./lib/cli-args.mjs";
import { resolveStateDir, writeManifest, readManifest, manifestFileName } from "./lib/manifest-store.mjs";

export class CloudflareApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Real Cloudflare API v4 client for the DNS records + Workers Custom
 * Domains operations cutover.mjs needs. Authenticates with
 * `CLOUDFLARE_API_TOKEN` and scopes account-level calls to
 * `CLOUDFLARE_ACCOUNT_ID` -- both passed in by the caller (main() reads
 * them from process.env; they are never a CLI flag and never appear in any
 * log line or thrown error message). The zone id for the apex domain is
 * resolved once, lazily, and cached for the life of the client.
 *
 * SWA hostname prevalidation (`requestSwaHostnameValidation` /
 * `getSwaHostnameStatus`) is an Azure Static Web Apps concern, not a
 * Cloudflare one. This client intentionally does NOT fabricate that state
 * -- it throws a clear error directing the operator to `--fixture` for the
 * `validate-swa-*` steps until a real Azure SWA client exists (see the
 * README's "API assumptions").
 */
export class RealCloudflareClient {
  constructor({ apiToken, accountId, apexDomain = "curations.dev", fetchImpl = fetch } = {}) {
    if (!apiToken) {
      throw new Error("RealCloudflareClient requires an API token (set CLOUDFLARE_API_TOKEN).");
    }
    if (!accountId) {
      throw new Error("RealCloudflareClient requires an account id (set CLOUDFLARE_ACCOUNT_ID).");
    }
    this._apiToken = apiToken;
    this._accountId = accountId;
    this._apexDomain = apexDomain;
    this._fetchImpl = fetchImpl;
    this._zoneId = null;
  }

  async _request(path, { method = "GET", body } = {}) {
    const response = await this._fetchImpl(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this._apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new CloudflareApiError(`Cloudflare API returned a non-JSON response (status ${response.status})`, {
        status: response.status,
      });
    }
    if (!payload || payload.success !== true) {
      const errors = (payload && payload.errors) || [];
      const summary = errors.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${response.status}`;
      throw new CloudflareApiError(`Cloudflare API error: ${summary}`, { status: response.status, errors });
    }
    return payload.result;
  }

  async _resolveZoneId() {
    if (this._zoneId) return this._zoneId;
    const zones = await this._request(`/zones?name=${encodeURIComponent(this._apexDomain)}`);
    if (!Array.isArray(zones) || zones.length === 0) {
      throw new CloudflareApiError(`No Cloudflare zone found for ${this._apexDomain}`);
    }
    this._zoneId = zones[0].id;
    return this._zoneId;
  }

  /**
   * Preflight check: confirms the token actually has both zone-scoped (DNS
   * records) and account-scoped (Workers Custom Domains) read access before
   * cutover.mjs performs its first mutation. This matters because a token
   * can be valid-but-narrowly-scoped -- e.g. `GET /user/tokens/verify` can
   * 401 for a token that nonetheless has full Zone/Account permissions, so
   * that endpoint is deliberately NOT used here. Exercising the exact two
   * read paths this tool actually depends on gives an accurate, specific
   * answer instead of a generic and potentially misleading self-check.
   * Never called mid-cutover -- always before the first write.
   */
  async preflight() {
    let zoneId;
    try {
      zoneId = await this._resolveZoneId();
    } catch (err) {
      throw new CloudflareApiError(
        `Cloudflare preflight failed: could not resolve the zone for '${this._apexDomain}'. ` +
          `The token may be invalid or missing Zone:Read permission for this zone. ` +
          `No changes were made. Underlying error: ${err && err.message ? err.message : err}`
      );
    }
    try {
      await this._request(`/accounts/${this._accountId}/workers/domains`);
    } catch (err) {
      throw new CloudflareApiError(
        `Cloudflare preflight failed: could not list Workers Custom Domains for account '${this._accountId}'. ` +
          `The token may be missing Workers Routes/Account:Read permission, or the account id may be wrong. ` +
          `No changes were made. Underlying error: ${err && err.message ? err.message : err}`
      );
    }
    return { ok: true, zoneId, accountId: this._accountId };
  }

  async getDnsRecord(hostname) {
    const zoneId = await this._resolveZoneId();
    const records = await this._request(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(hostname)}`);
    if (!Array.isArray(records) || records.length === 0) return null;
    const r = records[0];
    return { id: r.id, type: r.type, name: r.name, content: r.content, proxied: !!r.proxied };
  }

  async upsertDnsRecord(hostname, { content, proxied = false, type = "CNAME" }) {
    const zoneId = await this._resolveZoneId();
    const existing = await this.getDnsRecord(hostname);
    const body = { type, name: hostname, content, proxied, ttl: proxied ? 1 : 300 };
    if (existing) {
      const updated = await this._request(`/zones/${zoneId}/dns_records/${existing.id}`, { method: "PUT", body });
      return { id: updated.id, type: updated.type, name: updated.name, content: updated.content, proxied: !!updated.proxied };
    }
    const created = await this._request(`/zones/${zoneId}/dns_records`, { method: "POST", body });
    return { id: created.id, type: created.type, name: created.name, content: created.content, proxied: !!created.proxied };
  }

  async deleteDnsRecord(hostname) {
    const zoneId = await this._resolveZoneId();
    const existing = await this.getDnsRecord(hostname);
    if (!existing) return;
    await this._request(`/zones/${zoneId}/dns_records/${existing.id}`, { method: "DELETE" });
  }

  async getWorkerCustomDomain(hostname) {
    const domains = await this._request(`/accounts/${this._accountId}/workers/domains?hostname=${encodeURIComponent(hostname)}`);
    if (!Array.isArray(domains) || domains.length === 0) return null;
    const d = domains[0];
    return { id: d.id, hostname: d.hostname, service: d.service, environment: d.environment, zoneId: d.zone_id };
  }

  // Detaches the custom-domain binding only
  // (DELETE /accounts/{account_id}/workers/domains/{domain_id}). Never a
  // Worker-script-delete endpoint.
  async removeWorkerCustomDomain(hostname) {
    const existing = await this.getWorkerCustomDomain(hostname);
    if (!existing) return;
    await this._request(`/accounts/${this._accountId}/workers/domains/${existing.id}`, { method: "DELETE" });
  }

  // Reattaches via PUT /accounts/{account_id}/workers/domains
  // (hostname/service/environment/zone_id). Never creates or deletes the
  // Worker script itself.
  async attachWorkerCustomDomain(hostname, { service, environment, zoneId }) {
    const resolvedZoneId = zoneId || (await this._resolveZoneId());
    const created = await this._request(`/accounts/${this._accountId}/workers/domains`, {
      method: "PUT",
      body: { hostname, service, environment, zone_id: resolvedZoneId },
    });
    return {
      id: created.id,
      hostname: created.hostname,
      service: created.service,
      environment: created.environment,
      zoneId: created.zone_id,
    };
  }

  async requestSwaHostnameValidation() {
    throw new Error(
      "RealCloudflareClient does not implement Azure Static Web Apps hostname validation (that is an Azure, not Cloudflare, concern). Use --fixture for the validate-swa-* steps until a real Azure SWA client is built."
    );
  }

  async getSwaHostnameStatus() {
    throw new Error(
      "RealCloudflareClient does not implement Azure Static Web Apps hostname status checks (that is an Azure, not Cloudflare, concern). Use --fixture for the validate-swa-* steps until a real Azure SWA client is built."
    );
  }
}

export const PRODUCTION_CONFIRM_PHRASE = "curations.dev";
export const REHEARSAL_CONFIRM_PHRASE = "rehearse-cutover";

const ARG_SPEC = {
  fixture: { type: "string", default: "" },
  acceptance: { type: "string", default: "" },
  rehearse: { type: "boolean", default: false },
  apply: { type: "boolean", default: false },
  confirm: { type: "string", default: "" },
  rollback: { type: "string", default: "" },
  "manifest-dir": { type: "string", default: "" },
  "staging-api-hostname": { type: "string", default: "" },
  "staging-static-hostname": { type: "string", default: "" },
  "confirmed-manual-steps": { type: "string", default: "" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
};

function usage() {
  return `Usage: node scripts/azure/cutover.mjs --fixture <path> --acceptance <path> [--apply --confirm ${PRODUCTION_CONFIRM_PHRASE}] [--confirmed-manual-steps ${SET_DEFAULT_DOMAIN_STEP}] [--json]
       node scripts/azure/cutover.mjs --fixture <path> --rehearse --staging-api-hostname <h> --staging-static-hostname <h> [--apply --confirm ${REHEARSAL_CONFIRM_PHRASE}] [--json]
       node scripts/azure/cutover.mjs --rollback <manifest-path> --fixture <path> [--apply --confirm ${PRODUCTION_CONFIRM_PHRASE}] [--json]

Dry run by default. Refuses any mutation without the exact --confirm phrase.
Never deletes a Cloudflare Worker script or Pages deployment. The final
'${SET_DEFAULT_DOMAIN_STEP}' step is a manual Azure Portal gate (no az CLI
command exists for it yet) -- pass --confirmed-manual-steps ${SET_DEFAULT_DOMAIN_STEP}
only after performing it and confirming the 301 with
'verify.mjs --check-www-redirect'.`;
}

export class AcceptanceError extends Error {
  constructor(message) {
    super(message);
    this.name = "AcceptanceError";
  }
}

export class ConfirmationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfirmationError";
  }
}

/**
 * Validates the Azure acceptance-inputs file required before a production
 * cutover. Refuses (throws) if any required field is missing or false --
 * this check runs before any Cloudflare state is read or mutated.
 */
export function loadAcceptance(acceptancePath) {
  if (!acceptancePath) {
    throw new AcceptanceError(
      "Missing --acceptance <path>. Azure acceptance inputs (verified gateway/static hostnames, temp certificate readiness) are required before a production cutover."
    );
  }
  if (!fs.existsSync(acceptancePath)) {
    throw new AcceptanceError(`Acceptance file not found: ${acceptancePath}`);
  }
  const data = JSON.parse(fs.readFileSync(acceptancePath, "utf8"));
  const required = ["apiHostname", "staticWebAppHostname", "tempCertReady"];
  const missing = required.filter((key) => data[key] === undefined || data[key] === null || data[key] === "");
  if (missing.length > 0) {
    throw new AcceptanceError(`Acceptance file is missing required field(s): ${missing.join(", ")}`);
  }
  if (data.tempCertReady !== true) {
    throw new AcceptanceError("Acceptance file reports tempCertReady=false; refusing to cut API DNS before the temporary certificate is ready.");
  }
  if (data.verification && data.verification.ok === false) {
    throw new AcceptanceError("Acceptance file's embedded verification report is not ok; refusing cutover.");
  }
  return data;
}

/**
 * Computes the Cloudflare TXT record name Azure Static Web Apps expects for
 * `dns-txt-token` hostname validation: `_dnsauth.<hostname>` for both the
 * apex (`_dnsauth.curations.dev`) and a subdomain
 * (`_dnsauth.www.curations.dev`), per Azure Static Web Apps' custom-domain
 * validation documentation.
 */
export function swaValidationRecordName(hostname) {
  return `_dnsauth.${hostname}`;
}

/**
 * In-memory + on-disk fixture Cloudflare client. Represents Cloudflare zone
 * state as a plain JSON object so tests (and this task, which forbids real
 * production mutation) can exercise the full cutover/rollback mutation
 * sequence without any network access.
 *
 * This fixture also models the Azure Static Web Apps hostname-validation
 * resource (`swaHostnames`) so the SWA prevalidation step can be exercised
 * end-to-end offline. In production these are two distinct clients (a
 * Cloudflare REST client and an Azure CLI/SDK-backed SWA client); they are
 * combined here purely for local mock/test convenience -- see the
 * "API ASSUMPTION" note at the top of this file.
 */
export class FixtureCloudflareClient {
  constructor(fixturePath) {
    this.fixturePath = fixturePath;
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Cloudflare fixture not found: ${fixturePath}`);
    }
    this.state = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    if (!this.state.swaHostnames) this.state.swaHostnames = {};
  }

  _persist() {
    fs.writeFileSync(this.fixturePath, JSON.stringify(this.state, null, 2));
  }

  // The fixture stands in for a Cloudflare account that is always
  // reachable; mirrors RealCloudflareClient.preflight()'s shape so callers
  // never need to special-case which client implementation they hold.
  async preflight() {
    return { ok: true, zoneId: "fixture-zone-id", accountId: "fixture-account-id" };
  }

  async getDnsRecord(hostname) {
    return this.state.records[hostname] ? { ...this.state.records[hostname] } : null;
  }

  async upsertDnsRecord(hostname, { content, proxied = false, type = "CNAME" }) {
    const existing = this.state.records[hostname];
    const record = {
      id: existing ? existing.id : `rec-${hostname.replace(/\./g, "-")}`,
      type,
      name: hostname,
      content,
      proxied,
    };
    this.state.records[hostname] = record;
    this._persist();
    return { ...record };
  }

  async deleteDnsRecord(hostname) {
    delete this.state.records[hostname];
    this._persist();
  }

  async getWorkerCustomDomain(hostname) {
    const binding = this.state.workerCustomDomain;
    if (binding && binding.hostname === hostname) return { ...binding };
    return null;
  }

  // Detaches the custom-domain *binding* only (DELETE
  // /accounts/{account_id}/workers/domains/{domain_id} in real mode). This
  // must never call a Worker-script-delete endpoint -- the underlying
  // Worker keeps running. Cloudflare auto-manages a proxied placeholder
  // `AAAA 100::` record for a Worker Custom Domain; detaching removes that
  // record too (this fixture models that as an immediate, deterministic
  // side effect -- tests that need to exercise the "not yet propagated"
  // poll override getDnsRecord/getWorkerCustomDomain directly). The
  // Cloudflare Advanced Certificate for this hostname is never touched by
  // this method or any other method on this class -- there is no
  // certificate-delete capability here at all, by design.
  async removeWorkerCustomDomain(hostname) {
    if (this.state.workerCustomDomain && this.state.workerCustomDomain.hostname === hostname) {
      this.state.removedWorkerCustomDomain = this.state.workerCustomDomain;
      this.state.workerCustomDomain = null;
      const managedRecord = this.state.records[hostname];
      if (managedRecord && managedRecord.type === "AAAA" && managedRecord.managedByWorker) {
        this.state.removedManagedAaaaRecord = managedRecord;
        delete this.state.records[hostname];
      }
      this._persist();
    }
  }

  // Registers an Azure Static Web Apps custom hostname for `dns-txt-token`
  // validation. Non-disruptive: it never touches an existing Cloudflare
  // DNS record and does not affect live traffic. Idempotent -- calling it
  // again for the same hostname returns the same validation token rather
  // than minting a new one, matching Azure's real behavior of returning
  // the existing pending validation token on repeat calls.
  async requestSwaHostnameValidation(hostname) {
    const existing = this.state.swaHostnames[hostname];
    const txtRecordName = swaValidationRecordName(hostname);
    if (existing && existing.status !== "Ready") {
      return { validationToken: existing.validationToken, txtRecordName };
    }
    const validationToken = existing ? existing.validationToken : `fixture-validation-token-${hostname.replace(/\./g, "-")}`;
    this.state.swaHostnames[hostname] = { status: "Validating", validationToken, txtRecordName };
    this._persist();
    return { validationToken, txtRecordName };
  }

  // Reports the current SWA hostname-validation status. In this fixture,
  // Azure is modeled as confirming "Ready" once the expected
  // `_dnsauth.<hostname>` TXT record is present in Cloudflare with the
  // matching token -- the same condition the real service polls for.
  async getSwaHostnameStatus(hostname) {
    const entry = this.state.swaHostnames[hostname];
    if (!entry) return "NotRequested";
    const txtRecord = this.state.records[entry.txtRecordName];
    if (txtRecord && txtRecord.type === "TXT" && txtRecord.content === entry.validationToken) {
      entry.status = "Ready";
      this._persist();
      return "Ready";
    }
    return entry.status;
  }

  // Re-attaches a previously removed custom-domain binding
  // (`PUT /accounts/{account_id}/workers/domains` with
  // hostname/service/environment/zone_id in real mode). Never creates or
  // deletes the Worker script itself. Cloudflare recreates the managed
  // placeholder `AAAA 100::` record as part of reattaching -- modeled here
  // as an immediate, deterministic side effect for the same reason as
  // removeWorkerCustomDomain above.
  async attachWorkerCustomDomain(hostname, { service, environment, zoneId }) {
    const binding = { id: `wd-${hostname.replace(/\./g, "-")}`, hostname, service, environment, zoneId };
    this.state.workerCustomDomain = binding;
    this.state.records[hostname] = {
      id: `rec-managed-aaaa-${hostname.replace(/\./g, "-")}`,
      type: "AAAA",
      name: hostname,
      content: "100::",
      proxied: true,
      managedByWorker: true,
    };
    this._persist();
    return { ...binding };
  }
}

async function snapshotState(client, hostnames) {
  const [root, www, api, workerDomain] = await Promise.all([
    client.getDnsRecord(hostnames.root),
    client.getDnsRecord(hostnames.www),
    client.getDnsRecord(hostnames.api),
    client.getWorkerCustomDomain(hostnames.api),
  ]);
  return { root, www, api, workerDomain, capturedAt: new Date().toISOString() };
}

/**
 * Ordered cutover plan:
 *   1. Prevalidate both curations.dev and www.curations.dev as SWA custom
 *      hostnames (dns-txt-token) -- additive, non-traffic-affecting, and
 *      done first, while Cloudflare is still serving production.
 *   2. Cut API first, then apex, then www -- matching the plan's explicit
 *      "Cut API first, then frontend" mutation order. By the time these
 *      traffic-affecting steps run, both SWA hostnames are already Ready,
 *      so the apex/www CNAME flips complete without waiting on further
 *      DNS-validation propagation mid-cutover.
 */
export const SET_DEFAULT_DOMAIN_STEP = "set-default-domain";

/**
 * Ordered cutover plan:
 *   1. Prevalidate both curations.dev and www.curations.dev as SWA custom
 *      hostnames (dns-txt-token) -- additive, non-traffic-affecting, and
 *      done first, while Cloudflare is still serving production.
 *   2. Cut API first, then apex, then www -- matching the plan's explicit
 *      "Cut API first, then frontend" mutation order. By the time these
 *      traffic-affecting steps run, both SWA hostnames are already Ready,
 *      so the apex/www CNAME flips complete without waiting on further
 *      DNS-validation propagation mid-cutover.
 *   3. `set-default-domain` -- a manual Azure Portal gate. Production
 *      parity requires `https://www.curations.dev/` to keep 301-redirecting
 *      to `https://curations.dev/`, which Azure Static Web Apps provides by
 *      marking curations.dev as the app's *default custom domain* (every
 *      other bound hostname, including www and the generated
 *      *.azurestaticapps.net hostname, then redirects to it automatically).
 *      As of this writing the Azure CLI has no documented command for
 *      setting the default custom domain, so this tool cannot automate it
 *      -- it never fakes the redirect with host-matching rules in
 *      staticwebapp.config.json either. This step is a hard, explicit gate:
 *      it is only marked complete when the operator passes
 *      `--confirmed-manual-steps set-default-domain` (normally after
 *      performing the Portal action and independently confirming the 301
 *      with `verify.mjs --check-www-redirect`).
 */
export function computeCutoverPlan({ hostnames, azureTargets }) {
  return [
    {
      name: "validate-swa-root",
      kind: "validate",
      hostname: hostnames.root,
      description: "Prevalidate curations.dev as an SWA custom hostname (dns-txt-token) while Cloudflare still serves production",
    },
    {
      name: "validate-swa-www",
      kind: "validate",
      hostname: hostnames.www,
      description: "Prevalidate www.curations.dev as an SWA custom hostname (dns-txt-token) while Cloudflare still serves production",
    },
    {
      name: "cut-api",
      kind: "cut",
      hostname: hostnames.api,
      description: "Detach Worker custom domain, point api.curations.dev at the Azure gateway",
      targetContent: azureTargets.apiHostname,
    },
    {
      name: "cut-root",
      kind: "cut",
      hostname: hostnames.root,
      description: "CNAME-flatten curations.dev directly to the Azure Static Web App hostname (already prevalidated)",
      targetContent: azureTargets.staticWebAppHostname,
    },
    {
      name: "cut-www",
      kind: "cut",
      hostname: hostnames.www,
      description: "Point www.curations.dev at the Azure Static Web App hostname (already prevalidated)",
      targetContent: azureTargets.staticWebAppHostname,
    },
    {
      name: SET_DEFAULT_DOMAIN_STEP,
      kind: "manual-gate",
      hostname: hostnames.root,
      description:
        "Mark curations.dev as the Static Web App's default custom domain via the Azure Portal (no documented az CLI command exists for this) so www.curations.dev and the generated *.azurestaticapps.net hostname 301-redirect to it, matching current production parity.",
      instructions:
        "Azure Portal -> Static Web Apps -> <app> -> Custom domains -> select curations.dev -> 'Set as default'. " +
        "Then confirm with: node scripts/azure/verify.mjs --www-url https://www.curations.dev/ --site-url https://curations.dev/ --check-www-redirect. " +
        "Once that reports a 301 www-to-root redirect, re-run cutover.mjs with --confirmed-manual-steps set-default-domain to mark this step complete.",
    },
  ];
}

async function defaultVerifyStep(step, client) {
  if (step.kind === "manual-gate") {
    // Azure currently has no documented CLI command for this action, so
    // there is nothing for this tool to check via an API call. The only
    // thing that can make this "verified" is the operator's explicit
    // confirmation (set by the caller before calling verifyStep -- see
    // runCutover), normally given only after they've independently
    // confirmed the 301 with `verify.mjs --check-www-redirect`.
    return { ok: !!step.confirmed, manual: true };
  }
  if (step.kind === "validate") {
    const status = await client.getSwaHostnameStatus(step.hostname);
    return { ok: status === "Ready", status };
  }
  if (step.name === "cut-api") {
    const domain = await client.getWorkerCustomDomain(step.hostname);
    const record = await client.getDnsRecord(step.hostname);
    return {
      ok:
        domain === null &&
        !!record &&
        record.type === "CNAME" &&
        record.proxied === false &&
        record.content === step.targetContent,
    };
  }
  if (step.name === "restore-api") {
    const domain = await client.getWorkerCustomDomain(step.hostname);
    const record = await client.getDnsRecord(step.hostname);
    if (step.workerDomain) {
      // Rolled back to a Worker Custom Domain: Cloudflare must have
      // recreated the managed AAAA record and the binding must be present.
      return { ok: !!domain && !!record && record.type === "AAAA" };
    }
    // There was no Worker Custom Domain before cutover (unusual, but
    // possible for a rehearsal fixture) -- rollback just means the Azure
    // record is gone.
    return { ok: !record };
  }
  const record = await client.getDnsRecord(step.hostname);
  return { ok: !!record && record.content === step.targetContent };
}

/**
 * Bounded, injectable-delay poll for an SWA hostname to report "Ready"
 * after its validation TXT record is published. Real Azure DNS-01-style
 * validation can take a little time to propagate/poll; the fixture client
 * resolves to Ready on the very next check, so tests never actually sleep.
 */
async function waitForSwaHostnameReady(client, hostname, { retries = 5, delayMs = 2_000, sleepFn = defaultSleep } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const status = await client.getSwaHostnameStatus(hostname);
    if (status === "Ready") return { ok: true, status };
    if (attempt < retries - 1) await sleepFn(delayMs);
  }
  const finalStatus = await client.getSwaHostnameStatus(hostname);
  return { ok: finalStatus === "Ready", status: finalStatus };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bounded, injectable-delay poll confirming Cloudflare's managed
 * placeholder `AAAA 100::` record for a Worker Custom Domain has actually
 * disappeared after detaching. Cloudflare's removal is not necessarily
 * instantaneous, so the cut-api step must confirm this before creating the
 * Azure CNAME -- creating it earlier could collide with the still-present
 * managed record.
 */
async function waitForManagedAaaaRemoved(client, hostname, { retries = 5, delayMs = 2_000, sleepFn = defaultSleep } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const record = await client.getDnsRecord(hostname);
    if (!record || record.type !== "AAAA") return { ok: true };
    if (attempt < retries - 1) await sleepFn(delayMs);
  }
  const finalRecord = await client.getDnsRecord(hostname);
  return { ok: !finalRecord || finalRecord.type !== "AAAA", record: finalRecord };
}

/**
 * Bounded, injectable-delay poll confirming Cloudflare has recreated the
 * managed DNS for api.curations.dev after the Worker Custom Domain is
 * reattached during rollback.
 */
async function waitForManagedAaaaRestored(client, hostname, { retries = 5, delayMs = 2_000, sleepFn = defaultSleep } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const domain = await client.getWorkerCustomDomain(hostname);
    const record = await client.getDnsRecord(hostname);
    if (domain && record && record.type === "AAAA") return { ok: true };
    if (attempt < retries - 1) await sleepFn(delayMs);
  }
  const domain = await client.getWorkerCustomDomain(hostname);
  const record = await client.getDnsRecord(hostname);
  return { ok: !!(domain && record && record.type === "AAAA") };
}

/**
 * Applies the cut-api step precisely in the required order: detach the
 * Worker Custom Domain, confirm Cloudflare's managed AAAA record has
 * actually disappeared, and only then create the DNS-only Azure CNAME.
 * Throws (without creating the CNAME) if the managed record never clears
 * within the poll budget.
 */
async function applyCutApiStep(client, hostname, targetContent, workerBinding, pollOptions) {
  if (workerBinding) {
    await client.removeWorkerCustomDomain(hostname);
  }
  const removed = await waitForManagedAaaaRemoved(client, hostname, pollOptions);
  if (!removed.ok) {
    throw new Error(
      `Cloudflare's managed AAAA record for ${hostname} did not disappear after detaching the Worker Custom Domain; refusing to create the Azure CNAME while it is still present.`
    );
  }
  await client.upsertDnsRecord(hostname, { content: targetContent, proxied: false, type: "CNAME" });
}

/**
 * Runs (or dry-run-plans) the forward cutover. Fully injectable for tests:
 * deps.client must implement the FixtureCloudflareClient interface (a real
 * Cloudflare REST client would implement the same shape); deps.verifyStep
 * defaults to a fixture-aware verifier.
 */
export async function runCutover(options, deps) {
  const {
    hostnames,
    rehearse = false,
    apply = false,
    confirm = "",
    manifestDir = resolveStateDir(),
    confirmedManualSteps = [],
  } = options;
  const { client, verifyStep = defaultVerifyStep, writeManifestFn = writeManifest } = deps;

  const expectedConfirm = rehearse ? REHEARSAL_CONFIRM_PHRASE : PRODUCTION_CONFIRM_PHRASE;

  let acceptance = null;
  if (!rehearse) {
    // Refuses unconditionally (dry run or apply) if Azure acceptance
    // inputs are missing -- this must happen before any Cloudflare read.
    acceptance = loadAcceptance(options.acceptancePath);
  } else if (options.acceptancePath) {
    acceptance = loadAcceptance(options.acceptancePath);
  }

  const azureTargets = acceptance
    ? { apiHostname: acceptance.apiHostname, staticWebAppHostname: acceptance.staticWebAppHostname }
    : { apiHostname: options.stagingApiHostname, staticWebAppHostname: options.stagingStaticHostname };

  if (!azureTargets.apiHostname || !azureTargets.staticWebAppHostname) {
    throw new AcceptanceError(
      "Missing Azure target hostnames. Provide --acceptance for production, or --staging-api-hostname/--staging-static-hostname for --rehearse."
    );
  }

  const snapshot = await snapshotState(client, hostnames);
  const plan = computeCutoverPlan({ hostnames, azureTargets });

  const manifest = {
    kind: "cutover",
    rehearse,
    createdAt: new Date().toISOString(),
    hostnames,
    azureTargets,
    snapshot,
    plan: plan.map((s) => ({ name: s.name, kind: s.kind, hostname: s.hostname, description: s.description })),
    steps: [],
    status: "planned",
  };

  if (!(apply && confirm === expectedConfirm)) {
    return {
      applied: false,
      dryRun: true,
      rehearse,
      manifestWritten: false,
      snapshot,
      plan,
      reason: apply ? `--confirm must exactly equal '${expectedConfirm}'` : "dry run (pass --apply to execute)",
    };
  }

  // Preflight: confirm the Cloudflare token/account actually has the access
  // this cutover needs BEFORE the first mutation. A token can look valid
  // (reads succeed during the snapshot above) yet still be missing a scope
  // needed for a write, or -- in the case observed with the token
  // currently inherited in this environment -- a self-check endpoint like
  // `GET /user/tokens/verify` can return 401 even though the zone/account
  // reads this tool depends on work fine. Running the exact real-mode
  // client's preflight() here (a no-op for the fixture client) surfaces a
  // clear, specific failure before any DNS record or Worker Custom Domain
  // is touched, rather than discovering an auth problem partway through.
  if (typeof client.preflight === "function") {
    await client.preflight();
  }

  const workerBinding = snapshot.workerDomain;

  for (const step of plan) {
    try {
      if (step.kind === "manual-gate") {
        // No API mutation is possible here -- Azure has no documented CLI
        // command for setting the default custom domain. We only record
        // whether the operator has already confirmed performing it (and,
        // by convention, independently verifying the 301 redirect).
        step.confirmed = confirmedManualSteps.includes(step.name);
      } else if (step.kind === "validate") {
        // Non-traffic-affecting: register the SWA hostname for validation
        // and publish its _dnsauth TXT record. Existing CNAMEs/proxying for
        // this hostname are untouched, so production keeps being served by
        // Cloudflare Pages throughout this step.
        const { validationToken, txtRecordName } = await client.requestSwaHostnameValidation(step.hostname);
        await client.upsertDnsRecord(txtRecordName, { type: "TXT", content: validationToken, proxied: false });
        await waitForSwaHostnameReady(client, step.hostname, deps.swaPollOptions);
      } else if (step.name === "cut-api") {
        await applyCutApiStep(client, hostnames.api, step.targetContent, workerBinding, deps.aaaaPollOptions);
      } else {
        await client.upsertDnsRecord(step.hostname, { content: step.targetContent, proxied: false });
      }
    } catch (err) {
      // A step that fails to apply (e.g. the managed AAAA record never
      // clears) is recorded to the manifest just like a failed
      // verification, so a crash or refusal mid-cutover always leaves a
      // resumable/rollback-able trail.
      manifest.status = "failed";
      manifest.steps.push({
        name: step.name,
        hostname: step.hostname,
        appliedAt: new Date().toISOString(),
        error: err && err.message ? err.message : String(err),
      });
      const manifestPath = writeManifestFn(manifestDir, manifestFileName(rehearse ? "rehearsal" : "cutover"), manifest);
      throw new Error(`Step '${step.name}' failed to apply: ${err && err.message ? err.message : err}. Manifest written to ${manifestPath} for rollback.`);
    }
    const verification = await verifyStep(step, client);
    manifest.steps.push({
      name: step.name,
      hostname: step.hostname,
      appliedAt: new Date().toISOString(),
      verification,
      ...(step.kind === "manual-gate" ? { instructions: step.instructions } : {}),
    });
    // Persist progress after every single mutation so a crash mid-cutover
    // never loses the rollback trail.
    writeManifestFn(manifestDir, manifestFileName(rehearse ? "rehearsal" : "cutover"), manifest);
    if (!verification.ok) {
      if (step.kind === "manual-gate") {
        // Not a failure: every traffic-affecting mutation already
        // succeeded. This is a clean stop for a manual, unautomatable
        // Azure Portal action -- report it plainly rather than throwing.
        manifest.status = "awaiting-manual-step";
        const manifestPath = writeManifestFn(manifestDir, manifestFileName(rehearse ? "rehearsal" : "cutover"), manifest);
        return {
          applied: true,
          dryRun: false,
          rehearse,
          manifestWritten: true,
          manifestPath,
          snapshot,
          steps: manifest.steps,
          requiresManualStep: { name: step.name, instructions: step.instructions },
        };
      }
      manifest.status = "failed";
      const manifestPath = writeManifestFn(manifestDir, manifestFileName(rehearse ? "rehearsal" : "cutover"), manifest);
      throw new Error(`Verification failed after step '${step.name}'. Manifest written to ${manifestPath} for rollback.`);
    }
  }

  manifest.status = "complete";
  const manifestPath = writeManifestFn(manifestDir, manifestFileName(rehearse ? "rehearsal" : "cutover"), manifest);

  return { applied: true, dryRun: false, rehearse, manifestWritten: true, manifestPath, snapshot, steps: manifest.steps };
}

/**
 * Restores Cloudflare state from a rollback manifest: apex/www CNAMEs back
 * to their original Pages target, and the Worker custom-domain binding for
 * api.curations.dev back to its original state. Never deletes a Worker
 * script or Pages deployment -- only DNS records and the custom-domain
 * binding this tool itself created are touched.
 */
export async function runRollback(options, deps) {
  const { manifestPath, apply = false, confirm = "" } = options;
  const { client, verifyStep = defaultVerifyStep } = deps;

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error(`Rollback manifest not found: ${manifestPath}`);
  }
  const manifest = readManifest(manifestPath);
  const { hostnames, snapshot } = manifest;

  const plan = [
    { name: "restore-root", hostname: hostnames.root, targetContent: snapshot.root ? snapshot.root.content : null },
    { name: "restore-www", hostname: hostnames.www, targetContent: snapshot.www ? snapshot.www.content : null },
    { name: "restore-api", hostname: hostnames.api, targetContent: null, workerDomain: snapshot.workerDomain || null },
  ];

  if (!(apply && confirm === PRODUCTION_CONFIRM_PHRASE)) {
    return {
      applied: false,
      dryRun: true,
      plan,
      reason: apply ? `--confirm must exactly equal '${PRODUCTION_CONFIRM_PHRASE}'` : "dry run (pass --apply to execute)",
    };
  }

  const steps = [];
  for (const step of plan) {
    if (step.name === "restore-root" || step.name === "restore-www") {
      if (step.targetContent) {
        await client.upsertDnsRecord(step.hostname, { content: step.targetContent, proxied: true });
      }
    } else {
      // restore-api: delete the Azure CNAME, reattach the Worker Custom
      // Domain (PUT /accounts/{account_id}/workers/domains with
      // hostname/service/environment/zone_id), then confirm Cloudflare has
      // recreated the managed AAAA record. There is no "restore to
      // previous content" upsert here -- Cloudflare, not this tool,
      // recreates that record as a side effect of reattaching the custom
      // domain.
      await client.deleteDnsRecord(step.hostname);
      if (step.workerDomain) {
        await client.attachWorkerCustomDomain(step.hostname, {
          service: step.workerDomain.service,
          environment: step.workerDomain.environment,
          zoneId: step.workerDomain.zoneId,
        });
        const restored = await waitForManagedAaaaRestored(client, step.hostname, deps.aaaaPollOptions);
        if (!restored.ok) {
          throw new Error(
            `Cloudflare did not recreate the managed AAAA record for ${step.hostname} after reattaching the Worker Custom Domain during rollback.`
          );
        }
      }
    }
    const verification = await verifyStep(step, client);
    steps.push({ name: step.name, hostname: step.hostname, verification });
  }

  return { applied: true, dryRun: false, steps };
}

/**
 * Resolves which Cloudflare client to use: --fixture (offline/test) takes
 * priority when given; otherwise falls back to a real client authenticated
 * from CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in the environment
 * (never a CLI flag, never logged). Refuses clearly if neither is
 * available.
 */
export function loadCloudflareClient(values, env = process.env) {
  if (values.fixture) {
    return new FixtureCloudflareClient(values.fixture);
  }
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (apiToken && accountId) {
    return new RealCloudflareClient({ apiToken, accountId });
  }
  throw new Error(
    "Either --fixture <path>, or both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables, are required."
  );
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

  const hostnames = { root: "curations.dev", www: "www.curations.dev", api: "api.curations.dev" };
  const manifestDir = values["manifest-dir"] || resolveStateDir();

  try {
    let report;
    const client = loadCloudflareClient(values);
    if (values.rollback) {
      report = await runRollback(
        { manifestPath: values.rollback, apply: values.apply, confirm: values.confirm },
        { client }
      );
    } else {
      report = await runCutover(
        {
          hostnames,
          rehearse: values.rehearse,
          apply: values.apply,
          confirm: values.confirm,
          acceptancePath: values.acceptance || "",
          stagingApiHostname: values["staging-api-hostname"] || "",
          stagingStaticHostname: values["staging-static-hostname"] || "",
          manifestDir,
          confirmedManualSteps: values["confirmed-manual-steps"]
            ? values["confirmed-manual-steps"].split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        },
        { client }
      );
    }

    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`applied=${report.applied} dryRun=${report.dryRun}`);
      if (report.reason) console.log(`reason: ${report.reason}`);
      if (report.manifestPath) console.log(`manifest: ${report.manifestPath}`);
      if (report.requiresManualStep) {
        console.log(`\nManual step required: ${report.requiresManualStep.name}`);
        console.log(report.requiresManualStep.instructions);
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
