#!/usr/bin/env node
// scripts/azure/verify.mjs
//
// Verifies deployed Azure endpoints for the CurationsX Yolo migration:
// gateway liveness/readiness/health, public site routes, TLS certificate
// validity, required security headers, and a redaction-leak scan of every
// fetched response body. Every BASE URL is configurable via CLI flags --
// nothing is hardcoded to production, so this same tool verifies staging
// (generated Azure hostnames) or production.
//
// This tool is READ-ONLY by design: it only ever issues GET/HEAD/OPTIONS
// requests (enforced by lib/http.mjs's fetchWithTimeout) and never performs
// a production write of any kind, matching the plan's "no production
// writes by default" requirement -- there is no flag that changes this.
//
// Usage:
//   node scripts/azure/verify.mjs --gateway-url https://<gateway-host> \
//     --site-url https://<static-site-host> \
//     [--api-routes /api/live,/api/ready,/api/health] \
//     [--site-routes /] [--timeout 10000] [--skip-tls] [--json]
//
//   node scripts/azure/verify.mjs --check-www-redirect \
//     --www-url https://www.curations.dev/ --site-url https://curations.dev/
//     -- confirms production parity for Azure Static Web Apps' default
//     custom domain: https://www.curations.dev/ must still 301 to
//     https://curations.dev/, exactly as it does today on Cloudflare. This
//     is the post-cutover check for cutover.mjs's manual
//     'set-default-domain' Portal gate -- Azure has no documented CLI
//     command for that setting, so this is how the operator (not
//     staticwebapp.config.json host-matching rules) confirms it actually
//     took effect.
//
// Exit codes: 0 = every check passed, 1 = at least one check failed,
// 2 = invalid arguments.
import { parseArgs, CliArgError } from "./lib/cli-args.mjs";
import { fetchWithTimeout, inspectTlsCertificate, checkRequiredHeaders, checkPermanentRedirect } from "./lib/http.mjs";
import { scanForSecretLeak, redactLine } from "./lib/redaction.mjs";

const ARG_SPEC = {
  "gateway-url": { type: "string", default: "" },
  "site-url": { type: "string", default: "" },
  "www-url": { type: "string", default: "" },
  "api-routes": { type: "string", default: "/api/live,/api/ready,/api/health" },
  "site-routes": { type: "string", default: "/" },
  "check-www-redirect": { type: "boolean", default: false },
  timeout: { type: "string", default: "10000" },
  "skip-tls": { type: "boolean", default: false },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
};

function usage() {
  return `Usage: node scripts/azure/verify.mjs --gateway-url <url> --site-url <url>
                        [--api-routes /api/live,/api/ready,/api/health]
                        [--site-routes /] [--timeout 10000] [--skip-tls] [--json]
       node scripts/azure/verify.mjs --check-www-redirect --www-url <url> --site-url <url>

Read-only verification of deployed Azure endpoints. Never performs a
production write. At least one of --gateway-url / --site-url is required,
unless --check-www-redirect is used (which additionally requires --www-url).`;
}

function splitRoutes(value) {
  return value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
}

function joinUrl(base, route) {
  return new URL(route, base).toString();
}

async function checkGatewayHealth(gatewayUrl, routes, deps, timeoutMs) {
  const checks = [];
  for (const route of routes) {
    const url = joinUrl(gatewayUrl, route);
    try {
      const { response, durationMs } = await fetchWithTimeout(url, {
        timeoutMs,
        fetchImpl: deps.fetchImpl,
      });
      const bodyText = await response.text();
      const leak = scanForSecretLeak(bodyText);
      checks.push({
        name: `gateway:${route}`,
        ok: response.ok && !leak.leaked,
        status: response.status,
        durationMs,
        secretLeak: leak.leaked,
        findings: leak.leaked ? leak.findings : undefined,
      });
    } catch (err) {
      checks.push({ name: `gateway:${route}`, ok: false, error: String(err && err.message ? err.message : err) });
    }
  }
  return checks;
}

async function checkSiteRoutes(siteUrl, routes, deps, timeoutMs) {
  const checks = [];
  for (const route of routes) {
    const url = joinUrl(siteUrl, route);
    try {
      const { response, durationMs } = await fetchWithTimeout(url, {
        timeoutMs,
        fetchImpl: deps.fetchImpl,
      });
      const bodyText = await response.text();
      const leak = scanForSecretLeak(bodyText);
      const headerCheck = checkRequiredHeaders(response.headers);
      checks.push({
        name: `site:${route}`,
        ok: response.ok && !leak.leaked && headerCheck.ok,
        status: response.status,
        durationMs,
        contentType: response.headers.get("content-type"),
        missingHeaders: headerCheck.missing,
        secretLeak: leak.leaked,
        findings: leak.leaked ? leak.findings : undefined,
      });
    } catch (err) {
      checks.push({ name: `site:${route}`, ok: false, error: String(err && err.message ? err.message : err) });
    }
  }
  return checks;
}

async function checkTls(urlString, deps) {
  if (!urlString) return null;
  const parsed = new URL(urlString);
  if (parsed.protocol !== "https:") {
    return { name: `tls:${parsed.hostname}`, ok: true, skipped: true, reason: "non-TLS URL (fixture/local only)" };
  }
  try {
    const cert = await inspectTlsCertificate(parsed.hostname, Number(parsed.port) || 443, {
      connectImpl: deps.tlsConnectImpl,
    });
    const ok = cert.authorized !== false && cert.daysRemaining > 0;
    return { name: `tls:${parsed.hostname}`, ok, ...cert };
  } catch (err) {
    return { name: `tls:${parsed.hostname}`, ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Post-cutover check for production parity: https://www.curations.dev/
 * must 301 to https://curations.dev/, matching current production
 * behavior. Azure Static Web Apps provides this by marking curations.dev
 * as the app's default custom domain -- a manual Azure Portal action (see
 * cutover.mjs's `set-default-domain` step) with no documented az CLI
 * equivalent, and deliberately NOT faked with host-matching rules in
 * staticwebapp.config.json. This is the one authoritative way to confirm
 * it actually took effect.
 */
async function checkWwwRedirectStep(wwwUrl, siteUrl, deps, timeoutMs) {
  try {
    const result = await checkPermanentRedirect(wwwUrl, siteUrl, { timeoutMs, fetchImpl: deps.fetchImpl });
    return { name: "www-redirect", ...result };
  } catch (err) {
    return { name: "www-redirect", ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Core, fully testable verification routine. Accepts injectable deps so
 * tests never touch the real network or real TLS sockets.
 * @param {{ gatewayUrl?: string, siteUrl?: string, wwwUrl?: string, apiRoutes?: string[], siteRoutes?: string[], timeoutMs?: number, skipTls?: boolean, checkWwwRedirect?: boolean }} options
 * @param {{ fetchImpl?: typeof fetch, tlsConnectImpl?: Function }} [deps]
 */
export async function runVerification(options, deps = {}) {
  const {
    gatewayUrl = "",
    siteUrl = "",
    wwwUrl = "",
    apiRoutes = ["/api/live", "/api/ready", "/api/health"],
    siteRoutes = ["/"],
    timeoutMs = 10_000,
    skipTls = false,
    checkWwwRedirect = false,
  } = options;

  if (!gatewayUrl && !siteUrl) {
    throw new Error("At least one of gatewayUrl or siteUrl is required.");
  }
  if (checkWwwRedirect && (!wwwUrl || !siteUrl)) {
    throw new Error("--check-www-redirect requires both --www-url and --site-url.");
  }

  const checks = [];

  if (gatewayUrl) {
    checks.push(...(await checkGatewayHealth(gatewayUrl, apiRoutes, deps, timeoutMs)));
    if (!skipTls) {
      const tlsResult = await checkTls(gatewayUrl, deps);
      if (tlsResult) checks.push(tlsResult);
    }
  }

  if (siteUrl) {
    checks.push(...(await checkSiteRoutes(siteUrl, siteRoutes, deps, timeoutMs)));
    if (!skipTls) {
      const tlsResult = await checkTls(siteUrl, deps);
      if (tlsResult) checks.push(tlsResult);
    }
  }

  if (checkWwwRedirect) {
    checks.push(await checkWwwRedirectStep(wwwUrl, siteUrl, deps, timeoutMs));
  }

  const ok = checks.every((check) => check.ok);
  const safeChecks = checks.map((check) =>
    check.error ? { ...check, error: redactLine(check.error) } : check
  );
  return { ok, checkedAt: new Date().toISOString(), checks: safeChecks };
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
  if (!values["gateway-url"] && !values["site-url"]) {
    console.error("At least one of --gateway-url or --site-url is required.");
    console.error(usage());
    process.exit(2);
  }
  if (values["check-www-redirect"] && (!values["www-url"] || !values["site-url"])) {
    console.error("--check-www-redirect requires both --www-url and --site-url.");
    console.error(usage());
    process.exit(2);
  }

  const report = await runVerification({
    gatewayUrl: values["gateway-url"],
    siteUrl: values["site-url"],
    wwwUrl: values["www-url"],
    apiRoutes: splitRoutes(values["api-routes"]),
    siteRoutes: splitRoutes(values["site-routes"]),
    timeoutMs: Number(values.timeout),
    skipTls: values["skip-tls"],
    checkWwwRedirect: values["check-www-redirect"],
  });

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const check of report.checks) {
      const marker = check.ok ? "PASS" : "FAIL";
      const extras = [
        check.status ? `status=${check.status}` : "",
        check.location ? `location=${check.location}` : "",
        check.error ? `error=${check.error}` : "",
      ]
        .filter(Boolean)
        .join("  ");
      console.log(`${marker}  ${check.name}${extras ? `  ${extras}` : ""}`);
    }
    console.log(report.ok ? "\nAll checks passed." : "\nOne or more checks failed.");
  }

  process.exit(report.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}
