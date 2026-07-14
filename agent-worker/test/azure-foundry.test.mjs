import assert from "node:assert/strict";
import test from "node:test";

import { createAzureAgentModelClient } from "../src/platform/azure/foundry.ts";

class FakeTokenCredential {
  constructor(token = "fake-managed-identity-token") {
    this.token = token;
    this.requestedScopes = [];
  }

  async getToken(scope) {
    this.requestedScopes.push(scope);
    return this.token ? { token: this.token, expiresOnTimestamp: Date.now() + 60_000 } : null;
  }
}

test("Azure Foundry client authenticates with a managed-identity bearer token, never an API key", async () => {
  const credential = new FakeTokenCredential("mi-token-abc");
  let capturedHeaders;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedHeaders = init.headers;
    return Response.json({
      choices: [{ message: { content: " Reply text " } }],
      usage: { prompt_tokens: 12, completion_tokens: 34 },
    });
  };

  try {
    const client = createAzureAgentModelClient(
      { endpoint: "https://yolo-foundry.cognitiveservices.azure.com", deployment: "gpt-5.4-mini" },
      credential,
    );
    const result = await client.chat("system prompt", "user message", 200);
    assert.deepEqual(result, { text: "Reply text", promptTokens: 12, completionTokens: 34 });
    assert.equal(capturedHeaders.authorization, "Bearer mi-token-abc");
    assert.equal("api-key" in capturedHeaders, false);
    assert.deepEqual(credential.requestedScopes, ["https://cognitiveservices.azure.com/.default"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Azure Foundry client throws when managed identity cannot mint a token", async () => {
  const credential = new FakeTokenCredential(null);
  const client = createAzureAgentModelClient(
    { endpoint: "https://yolo-foundry.cognitiveservices.azure.com", deployment: "gpt-5.4-mini" },
    credential,
  );
  await assert.rejects(client.chat("system", "message", 100), /did not return a Foundry access token/);
});

test("Azure Foundry client still enforces the gpt-5.4-mini deployment restriction", async () => {
  const credential = new FakeTokenCredential();
  const client = createAzureAgentModelClient(
    { endpoint: "https://yolo-foundry.cognitiveservices.azure.com", deployment: "gpt-6-large" },
    credential,
  );
  await assert.rejects(client.chat("system", "message", 100), /restricted to the gpt-5\.4-mini deployment/);
});
