import assert from "node:assert/strict";
import test from "node:test";

import { GatewayError, GatewayErrors, isGatewayError } from "../src/platform/azure/errors.ts";

test("GatewayError carries a stable code, status, retryability, and safe message", () => {
  const error = new GatewayError("quota_reached", 429, "Daily capacity reached.", {
    retryable: true,
    retryAfterSeconds: 30,
    context: { rule: "user" },
  });
  assert.equal(error.name, "GatewayError");
  assert.equal(error.code, "quota_reached");
  assert.equal(error.status, 429);
  assert.equal(error.retryable, true);
  assert.equal(error.retryAfterSeconds, 30);
  assert.deepEqual(error.context, { rule: "user" });
  assert.deepEqual(error.toJSON(), { error: "Daily capacity reached.", code: "quota_reached", retryable: true });
});

test("GatewayError defaults to non-retryable with no context", () => {
  const error = new GatewayError("not_found", 404, "not found");
  assert.equal(error.retryable, false);
  assert.equal(error.retryAfterSeconds, undefined);
  assert.equal(error.context, undefined);
});

test("GatewayError.toResponse renders JSON with CORS headers and an optional Retry-After", async () => {
  const error = GatewayErrors.quotaReached(15);
  const response = error.toResponse({ "access-control-allow-origin": "https://curations.dev" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://curations.dev");
  assert.equal(response.headers.get("retry-after"), "15");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(body, { error: error.message, code: "quota_reached", retryable: true });
});

test("GatewayError.toResponse omits Retry-After when not set", () => {
  const response = GatewayErrors.sessionExpired().toResponse();
  assert.equal(response.headers.get("retry-after"), null);
});

test("isGatewayError distinguishes GatewayError from ordinary errors", () => {
  assert.equal(isGatewayError(new GatewayError("not_found", 404, "x")), true);
  assert.equal(isGatewayError(new Error("plain")), false);
  assert.equal(isGatewayError("not an error"), false);
  assert.equal(isGatewayError(null), false);
});

test("GatewayErrors factory covers every documented failure mode", () => {
  const cases = [
    ["oauthStateExpired", 400, "oauth_state_expired"],
    ["sessionExpired", 401, "session_expired"],
    ["copilotGrantConsumed", 409, "copilot_grant_consumed"],
    ["agentLimitReached", 429, "agent_limit_reached"],
    ["copilotRuntimeTimeout", 504, "copilot_runtime_timeout"],
    ["copilotRuntimeUnavailable", 502, "copilot_runtime_unavailable"],
    ["configInvalid", 500, "config_invalid"],
    ["notFound", 404, "not_found"],
  ];
  for (const [factory, status, code] of cases) {
    const error = GatewayErrors[factory]();
    assert.equal(error.status, status, factory);
    assert.equal(error.code, code, factory);
  }

  assert.equal(GatewayErrors.invalidRequest().code, "invalid_request");
  assert.equal(GatewayErrors.invalidRequest("custom message").message, "custom message");
  assert.deepEqual(GatewayErrors.dependencyThrottled(5, { store: "quota" }).context, { store: "quota" });
});

test("cause is preserved when provided", () => {
  const cause = new Error("root cause");
  const error = new GatewayError("config_invalid", 500, "bad config", { cause });
  assert.equal(error.cause, cause);
});
