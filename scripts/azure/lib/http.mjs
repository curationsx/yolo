// scripts/azure/lib/http.mjs
//
// Minimal, dependency-free HTTP + TLS helpers shared by the Node-based
// scripts/azure/*.mjs tools. Every function accepts an injectable
// implementation so tests never make real network calls.

import tls from "node:tls";

/**
 * Fetches a URL with a bounded timeout. Read-only by design: callers in
 * this repo must only ever pass GET/HEAD/OPTIONS methods.
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, timeoutMs?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchWithTimeout(url, opts = {}) {
  const {
    method = "GET",
    headers = {},
    timeoutMs = 10_000,
    fetchImpl = fetch,
    redirect = "follow",
  } = opts;
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    throw new Error(
      `Refusing non-read-only HTTP method '${method}'. scripts/azure verification tools must never perform production writes.`
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const start = Date.now();
    const response = await fetchImpl(url, { method, headers, redirect, signal: controller.signal });
    const durationMs = Date.now() - start;
    return { response, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Inspects the TLS certificate presented by a host without downloading a
 * full response body. Returns null (rather than throwing) when the target
 * is not TLS (e.g. plain http:// used only in local fixtures/tests).
 * @param {string} hostname
 * @param {number} [port]
 * @param {{ timeoutMs?: number, connectImpl?: typeof tls.connect }} [opts]
 */
export function inspectTlsCertificate(hostname, port = 443, opts = {}) {
  const { timeoutMs = 8_000, connectImpl = tls.connect } = opts;
  return new Promise((resolve, reject) => {
    const socket = connectImpl(
      { host: hostname, port, servername: hostname, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const authorizationError = socket.authorizationError;
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error(`No certificate presented by ${hostname}:${port}`));
          return;
        }
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        resolve({
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysRemaining,
          authorized,
          authorizationError: authorized ? null : String(authorizationError),
        });
      }
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${hostname}:${port} timed out after ${timeoutMs}ms`));
    });
    socket.on("error", (err) => reject(err));
  });
}

/**
 * Required security headers policy referenced by
 * .azure/deployment-plan.md's "Static Site Configuration" section.
 */
export const REQUIRED_SITE_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
];

export function checkRequiredHeaders(headers, required = REQUIRED_SITE_HEADERS) {
  const missing = required.filter((name) => !headers.has(name));
  return { ok: missing.length === 0, missing };
}

/**
 * Checks that fetching `fromUrl` (without following the redirect) returns a
 * permanent (301) redirect whose Location resolves to `toUrl`. Used to
 * confirm production parity for Azure Static Web Apps' default-custom-domain
 * behavior: https://www.curations.dev/ must 301 to https://curations.dev/,
 * exactly as it does today on Cloudflare. This performs exactly one GET
 * request with redirect following disabled -- still read-only, never a
 * production write.
 * @param {string} fromUrl
 * @param {string} toUrl
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, expectedStatus?: number }} [opts]
 */
export async function checkPermanentRedirect(fromUrl, toUrl, opts = {}) {
  const { timeoutMs = 10_000, fetchImpl, expectedStatus = 301 } = opts;
  const { response } = await fetchWithTimeout(fromUrl, { timeoutMs, fetchImpl, redirect: "manual" });
  const location = response.headers.get("location");
  const normalizedLocation = location ? new URL(location, fromUrl).toString() : null;
  const normalizedTarget = new URL(toUrl).toString();
  const ok = response.status === expectedStatus && normalizedLocation === normalizedTarget;
  return { ok, status: response.status, expectedStatus, location: normalizedLocation, target: normalizedTarget };
}
