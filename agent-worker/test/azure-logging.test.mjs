import assert from "node:assert/strict";
import test from "node:test";

import { assertNoSecretLeak, logError, logRequest, redactHeaders } from "../src/platform/azure/logging.ts";

test("redactHeaders hides authorization, cookie, and the runtime shared secret", () => {
  const headers = new Headers({
    authorization: "Bearer super-secret-token",
    cookie: "session=abc123",
    "x-copilot-runtime-secret": "runtime-secret",
    "content-type": "application/json",
  });
  const redacted = redactHeaders(headers);
  assert.equal(redacted.authorization, "[redacted]");
  assert.equal(redacted.cookie, "[redacted]");
  assert.equal(redacted["x-copilot-runtime-secret"], "[redacted]");
  assert.equal(redacted["content-type"], "application/json");
});

test("logRequest emits structured, non-secret request fields", () => {
  const originalLog = console.log;
  let captured;
  console.log = (line) => {
    captured = line;
  };
  try {
    logRequest({ route: "/api/health", method: "GET", status: 200, latencyMs: 12, correlationId: "abc-123" });
  } finally {
    console.log = originalLog;
  }
  const parsed = JSON.parse(captured);
  assert.equal(parsed.route, "/api/health");
  assert.equal(parsed.status, 200);
  assert.equal(parsed.correlation_id, "abc-123");
});

test("logError never includes the raw error's non-message fields", () => {
  const originalError = console.error;
  let captured;
  console.error = (line) => {
    captured = line;
  };
  try {
    logError("/api/copilot/run", "correlation-1", new Error("boom"));
  } finally {
    console.error = originalError;
  }
  const parsed = JSON.parse(captured);
  assert.equal(parsed.message, "boom");
  assert.equal(parsed.correlation_id, "correlation-1");
});

test("logError falls back to a generic message for non-Error values", () => {
  const originalError = console.error;
  let captured;
  console.error = (line) => {
    captured = line;
  };
  try {
    logError("/api/copilot/run", "correlation-2", "a plain string was thrown");
  } finally {
    console.error = originalError;
  }
  assert.equal(JSON.parse(captured).message, "unknown error");
});

test("assertNoSecretLeak detects a leaked secret and ignores empty values", () => {
  assert.equal(assertNoSecretLeak("safe log line", ["gho_secrettoken"]), true);
  assert.equal(assertNoSecretLeak("leaked gho_secrettoken here", ["gho_secrettoken"]), false);
  assert.equal(assertNoSecretLeak("safe log line", ["", undefined]), true);
});
