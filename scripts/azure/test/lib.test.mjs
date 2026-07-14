// scripts/azure/test/lib.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { parseArgs, CliArgError } from "../lib/cli-args.mjs";
import { redactLine, scanForSecretLeak } from "../lib/redaction.mjs";
import { resolveStateDir } from "../lib/manifest-store.mjs";
import { checkRequiredHeaders, checkPermanentRedirect } from "../lib/http.mjs";

test("parseArgs parses booleans, strings, and rejects unknown flags into `unknown`", () => {
  const { values, unknown } = parseArgs(["--apply", "--confirm", "curations.dev", "--extra"], {
    apply: { type: "boolean", default: false },
    confirm: { type: "string", default: "" },
  });
  assert.equal(values.apply, true);
  assert.equal(values.confirm, "curations.dev");
  assert.deepEqual(unknown, ["--extra"]);
});

test("parseArgs throws CliArgError when a string flag is missing its value", () => {
  assert.throws(
    () => parseArgs(["--confirm"], { confirm: { type: "string", default: "" } }),
    CliArgError
  );
});

test("redactLine redacts secret-shaped key/value pairs but leaves other text alone", () => {
  const line = redactLine("client_secret=abc123 status=ok token: xyz789");
  assert.ok(!line.includes("abc123"));
  assert.ok(!line.includes("xyz789"));
  assert.ok(line.includes("status=ok"));
});

test("scanForSecretLeak detects a GitHub-token-shaped value without echoing it back in full", () => {
  const secret = "ghp_" + "a".repeat(36);
  const result = scanForSecretLeak(`{"token":"${secret}"}`);
  assert.equal(result.leaked, true);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test("scanForSecretLeak reports no leak for ordinary text", () => {
  const result = scanForSecretLeak('{"status":"ok","count":3}');
  assert.equal(result.leaked, false);
  assert.deepEqual(result.findings, []);
});

test("resolveStateDir defaults outside the repository (under the home directory)", () => {
  delete process.env.YOLO_CUTOVER_STATE_DIR;
  const dir = resolveStateDir(undefined);
  assert.ok(dir.startsWith(os.homedir()));
  assert.ok(!dir.includes(path.join("yolo", "scripts")));
});

test("resolveStateDir honors an explicit override", () => {
  const dir = resolveStateDir("/custom/path");
  assert.equal(dir, "/custom/path");
});

test("checkRequiredHeaders reports missing headers precisely", () => {
  const headers = new Map([["content-type", "text/html"]]);
  const result = checkRequiredHeaders({ has: (n) => headers.has(n) });
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("content-security-policy"));
});

function mockRedirectFetch(status, location) {
  return async () => ({
    status,
    headers: { get: (name) => (name.toLowerCase() === "location" ? location : null) },
  });
}

test("checkPermanentRedirect passes when a 301 Location matches the expected target", async () => {
  const fetchImpl = mockRedirectFetch(301, "https://curations.dev/");
  const result = await checkPermanentRedirect("https://www.curations.dev/", "https://curations.dev/", { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.status, 301);
});

test("checkPermanentRedirect fails when the status is not 301 (e.g. a temporary 302)", async () => {
  const fetchImpl = mockRedirectFetch(302, "https://curations.dev/");
  const result = await checkPermanentRedirect("https://www.curations.dev/", "https://curations.dev/", { fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.status, 302);
});

test("checkPermanentRedirect fails when Location points somewhere else entirely", async () => {
  const fetchImpl = mockRedirectFetch(301, "https://not-curations.example/");
  const result = await checkPermanentRedirect("https://www.curations.dev/", "https://curations.dev/", { fetchImpl });
  assert.equal(result.ok, false);
});

test("checkPermanentRedirect never follows the redirect (uses redirect: 'manual')", async () => {
  let observedRedirectMode = null;
  const fetchImpl = async (_url, init) => {
    observedRedirectMode = init.redirect;
    return { status: 301, headers: { get: () => "https://curations.dev/" } };
  };
  await checkPermanentRedirect("https://www.curations.dev/", "https://curations.dev/", { fetchImpl });
  assert.equal(observedRedirectMode, "manual");
});
