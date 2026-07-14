import assert from "node:assert/strict";
import test from "node:test";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

import { createAzureCredential, getSharedAzureCredential, loadAzureConfig } from "../src/platform/azure/config.ts";
import { isGatewayError } from "../src/platform/azure/errors.ts";

function validEnv(overrides = {}) {
  return {
    ALLOWED_ORIGINS: "https://curations.dev",
    COSMOS_ENDPOINT: "https://yolo-curations-feed.documents.azure.com",
    COSMOS_DATABASE: "curations",
    COSMOS_CONTAINER: "engagements",
    COSMOS_VOTES_CONTAINER: "votes",
    COSMOS_SCORES_CONTAINER: "scores",
    COSMOS_DISCUSSIONS_CONTAINER: "discussions",
    AZURE_OPENAI_ENDPOINT: "https://yolo-foundry.cognitiveservices.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "gpt-5.4-mini",
    COPILOT_RUNTIME_URL: "https://ca-yolo-copilot.internal",
    COPILOT_RUNTIME_SHARED_SECRET: "runtime-secret",
    SOFTWARE_TARGETS: "cloudflare,supabase",
    ...overrides,
  };
}

test("loadAzureConfig parses a fully configured environment", () => {
  const config = loadAzureConfig(validEnv({ PORT: "9090" }));
  assert.equal(config.port, 9090);
  assert.equal(config.cosmosGatewayStateContainer, "gateway-state");
  assert.equal(config.voteBackend, "durable");
  assert.equal(config.copilotRuntimeTimeoutMs, 150_000);
});

test("loadAzureConfig defaults optional tuning variables", () => {
  const config = loadAzureConfig(validEnv());
  assert.equal(config.maxQuestionChars, "4000");
  assert.equal(config.copilotModel, "gpt-5.4");
  assert.equal(config.perIpDailyLimit, "10");
});

test("loadAzureConfig honors an explicit legacy kv vote backend", () => {
  const config = loadAzureConfig(validEnv({ VOTE_BACKEND: "kv" }));
  assert.equal(config.voteBackend, "kv");
});

test("loadAzureConfig fails fast, reporting every missing variable at once", () => {
  assert.throws(() => loadAzureConfig({}), (error) => {
    assert.ok(isGatewayError(error));
    assert.equal(error.code, "config_invalid");
    assert.ok(Array.isArray(error.context.missing));
    assert.ok(error.context.missing.includes("ALLOWED_ORIGINS"));
    assert.ok(error.context.missing.includes("COSMOS_ENDPOINT"));
    assert.ok(error.context.missing.includes("COPILOT_RUNTIME_SHARED_SECRET"));
    return true;
  });
});

test("loadAzureConfig rejects an invalid PORT and runtime timeout", () => {
  assert.throws(() => loadAzureConfig(validEnv({ PORT: "not-a-number" })), (error) => {
    assert.ok(error.context.missing.some((entry) => entry.startsWith("PORT")));
    return true;
  });
  assert.throws(() => loadAzureConfig(validEnv({ COPILOT_RUNTIME_TIMEOUT_MS: "0" })), (error) => {
    assert.ok(error.context.missing.some((entry) => entry.startsWith("COPILOT_RUNTIME_TIMEOUT_MS")));
    return true;
  });
});

test("createAzureCredential selects ManagedIdentityCredential when AZURE_CLIENT_ID is configured", () => {
  const config = loadAzureConfig(validEnv({ AZURE_CLIENT_ID: "11111111-1111-1111-1111-111111111111" }));
  assert.ok(createAzureCredential(config) instanceof ManagedIdentityCredential);
});

test("createAzureCredential falls back to DefaultAzureCredential for local development", () => {
  const config = loadAzureConfig(validEnv());
  assert.equal(config.azureClientId, undefined);
  assert.ok(createAzureCredential(config) instanceof DefaultAzureCredential);
});

test("getSharedAzureCredential memoizes one credential per process", () => {
  const config = loadAzureConfig(validEnv());
  const first = getSharedAzureCredential(config);
  const second = getSharedAzureCredential(config);
  assert.equal(first, second);
});
