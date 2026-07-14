import assert from "node:assert/strict";
import test from "node:test";

import { chat, chatWithBearerToken } from "../src/azure.ts";

test("Cloudflare chat() authenticates with an api-key header", async () => {
  let capturedHeaders;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    return Response.json({
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });
  };
  try {
    const result = await chat(
      { endpoint: "https://azure.invalid", apiKey: "test-key", deployment: "gpt-5.4-mini", maxOutputTokens: 100 },
      "system",
      "message",
    );
    assert.deepEqual(result, { text: "hello", promptTokens: 1, completionTokens: 2 });
    assert.equal(capturedHeaders["api-key"], "test-key");
    assert.equal("authorization" in capturedHeaders, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat() surfaces a non-ok Azure OpenAI response as a typed error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", { status: 429 });
  try {
    await assert.rejects(
      chat(
        { endpoint: "https://azure.invalid", apiKey: "test-key", deployment: "gpt-5.4-mini", maxOutputTokens: 100 },
        "system",
        "message",
      ),
      /azure openai error: 429/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chatWithBearerToken() rejects any deployment other than gpt-5.4-mini", async () => {
  await assert.rejects(
    chatWithBearerToken(
      { endpoint: "https://azure.invalid", deployment: "gpt-6", maxOutputTokens: 100 },
      "token",
      "system",
      "message",
    ),
    /restricted to the gpt-5\.4-mini deployment/,
  );
});
