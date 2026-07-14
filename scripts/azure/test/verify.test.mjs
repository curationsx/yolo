// scripts/azure/test/verify.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runVerification } from "../verify.mjs";

function mockResponse({ status = 200, body = "{}", headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headerMap.get(name.toLowerCase()) ?? null,
      has: (name) => headerMap.has(name.toLowerCase()),
    },
    text: async () => body,
  };
}

const HEALTHY_SITE_HEADERS = {
  "content-security-policy": "default-src 'self'",
  "strict-transport-security": "max-age=63072000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-type": "text/html",
};

test("runVerification passes when gateway health routes are healthy", async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /\/api\/(live|ready|health)$/);
    return mockResponse({ status: 200, body: '{"status":"ok"}' });
  };
  const report = await runVerification(
    { gatewayUrl: "https://gateway.example.internal", skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 3);
  assert.ok(report.checks.every((c) => c.ok));
});

test("runVerification fails when a gateway route returns 5xx", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/api/ready")) {
      return mockResponse({ status: 503, body: '{"error":"dependency_throttled"}' });
    }
    return mockResponse({ status: 200, body: '{"status":"ok"}' });
  };
  const report = await runVerification(
    { gatewayUrl: "https://gateway.example.internal", skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, false);
  const failing = report.checks.find((c) => c.name === "gateway:/api/ready");
  assert.equal(failing.ok, false);
  assert.equal(failing.status, 503);
});

test("runVerification fails and reports (without leaking) when a secret leaks into a body", async () => {
  const leaked = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const fetchImpl = async () => mockResponse({ status: 200, body: `{"token":"${leaked}"}` });
  const report = await runVerification(
    { gatewayUrl: "https://gateway.example.internal", apiRoutes: ["/api/live"], skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, false);
  const check = report.checks[0];
  assert.equal(check.secretLeak, true);
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes(leaked), "full secret value must never appear in the report");
});

test("runVerification enforces required security headers on site routes", async () => {
  const fetchImpl = async () => mockResponse({ status: 200, body: "<html></html>", headers: { "content-type": "text/html" } });
  const report = await runVerification(
    { siteUrl: "https://site.example.internal", siteRoutes: ["/"], skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, false);
  const check = report.checks[0];
  assert.ok(check.missingHeaders.length > 0);
});

test("runVerification passes site routes when required headers are present", async () => {
  const fetchImpl = async () => mockResponse({ status: 200, body: "<html></html>", headers: HEALTHY_SITE_HEADERS });
  const report = await runVerification(
    { siteUrl: "https://site.example.internal", siteRoutes: ["/"], skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, true);
});

test("runVerification checks TLS certificate validity via injected tls connector", async () => {
  const fetchImpl = async () => mockResponse({ status: 200, headers: HEALTHY_SITE_HEADERS, body: "<html></html>" });
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  const tlsConnectImpl = (_opts, onConnect) => {
    const fakeSocket = {
      getPeerCertificate: () => ({
        subject: { CN: "site.example.internal" },
        issuer: { CN: "Fixture CA" },
        valid_from: new Date().toUTCString(),
        valid_to: future,
      }),
      authorized: true,
      authorizationError: null,
      end: () => {},
      setTimeout: () => {},
      on: () => {},
    };
    setImmediate(() => onConnect());
    return fakeSocket;
  };
  const report = await runVerification(
    { siteUrl: "https://site.example.internal", siteRoutes: ["/"] },
    { fetchImpl, tlsConnectImpl }
  );
  const tlsCheck = report.checks.find((c) => c.name.startsWith("tls:"));
  assert.ok(tlsCheck, "expected a TLS check to be present");
  assert.equal(tlsCheck.ok, true);
  assert.ok(tlsCheck.daysRemaining > 0);
});

test("runVerification fails TLS check when certificate is expired", async () => {
  const fetchImpl = async () => mockResponse({ status: 200, headers: HEALTHY_SITE_HEADERS, body: "<html></html>" });
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toUTCString();
  const tlsConnectImpl = (_opts, onConnect) => {
    const fakeSocket = {
      getPeerCertificate: () => ({
        subject: { CN: "site.example.internal" },
        issuer: { CN: "Fixture CA" },
        valid_from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toUTCString(),
        valid_to: past,
      }),
      authorized: true,
      authorizationError: null,
      end: () => {},
      setTimeout: () => {},
      on: () => {},
    };
    setImmediate(() => onConnect());
    return fakeSocket;
  };
  const report = await runVerification(
    { siteUrl: "https://site.example.internal", siteRoutes: ["/"] },
    { fetchImpl, tlsConnectImpl }
  );
  const tlsCheck = report.checks.find((c) => c.name.startsWith("tls:"));
  assert.equal(tlsCheck.ok, false);
});

test("runVerification throws when neither gatewayUrl nor siteUrl is provided", async () => {
  await assert.rejects(() => runVerification({}, {}));
});

test("runVerification never issues a non-read-only HTTP method", async () => {
  // fetchWithTimeout enforces this; confirm the guard is reachable through
  // the public surface by asserting the default behavior stays GET-only.
  let observedMethod = null;
  const fetchImpl = async (_url, init) => {
    observedMethod = init && init.method;
    return mockResponse({ status: 200, body: "{}" });
  };
  await runVerification(
    { gatewayUrl: "https://gateway.example.internal", apiRoutes: ["/api/live"], skipTls: true },
    { fetchImpl }
  );
  assert.equal(observedMethod, "GET");
});

test("runVerification throws when checkWwwRedirect is set without both wwwUrl and siteUrl", async () => {
  await assert.rejects(
    () => runVerification({ gatewayUrl: "https://gateway.example.internal", checkWwwRedirect: true, skipTls: true }, {}),
    /--check-www-redirect requires both --www-url and --site-url/
  );
});

test("runVerification's --check-www-redirect passes when www 301s to the site root (production parity)", async () => {
  const fetchImpl = async (url, init) => {
    const urlStr = String(url);
    if (init && init.redirect === "manual") {
      assert.equal(urlStr, "https://www.curations.dev/");
      return { status: 301, headers: { get: (n) => (n.toLowerCase() === "location" ? "https://curations.dev/" : null) } };
    }
    return mockResponse({ status: 200, body: "<html></html>", headers: HEALTHY_SITE_HEADERS });
  };
  const report = await runVerification(
    {
      siteUrl: "https://curations.dev/",
      wwwUrl: "https://www.curations.dev/",
      checkWwwRedirect: true,
      siteRoutes: ["/"],
      skipTls: true,
    },
    { fetchImpl }
  );
  const redirectCheck = report.checks.find((c) => c.name === "www-redirect");
  assert.ok(redirectCheck, "expected a www-redirect check to be present");
  assert.equal(redirectCheck.ok, true);
  assert.equal(redirectCheck.status, 301);
});

test("runVerification's --check-www-redirect fails (and the whole report fails) when www does not 301 to the site root", async () => {
  const fetchImpl = async (url, init) => {
    if (init && init.redirect === "manual") {
      return { status: 200, headers: { get: () => null } };
    }
    return mockResponse({ status: 200, body: "<html></html>", headers: HEALTHY_SITE_HEADERS });
  };
  const report = await runVerification(
    {
      siteUrl: "https://curations.dev/",
      wwwUrl: "https://www.curations.dev/",
      checkWwwRedirect: true,
      siteRoutes: ["/"],
      skipTls: true,
    },
    { fetchImpl }
  );
  const redirectCheck = report.checks.find((c) => c.name === "www-redirect");
  assert.equal(redirectCheck.ok, false);
  assert.equal(report.ok, false, "an unconfirmed production-parity redirect must fail the overall report");
});

test("runVerification with --site-url only never attempts a gateway check (safe to run from any network, including CI)", async () => {
  // The staging/production gateway is IP-restricted to Wyatt only; a
  // GitHub-hosted runner must be able to verify just the public Static Web
  // App site without ever needing (or being able) to reach the gateway.
  let gatewayRouteRequested = false;
  const fetchImpl = async (url) => {
    if (String(url).includes("/api/")) gatewayRouteRequested = true;
    return mockResponse({ status: 200, body: "<html></html>", headers: HEALTHY_SITE_HEADERS });
  };
  const report = await runVerification(
    { siteUrl: "https://curations.dev/", siteRoutes: ["/"], skipTls: true },
    { fetchImpl }
  );
  assert.equal(report.ok, true);
  assert.equal(gatewayRouteRequested, false, "a site-only invocation must never touch any /api/* gateway route");
  assert.ok(
    report.checks.every((c) => c.name.startsWith("site:") || c.name.startsWith("tls:")),
    "every check in a site-only run must be a site or TLS check, never a gateway check"
  );
});

