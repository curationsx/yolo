import assert from "node:assert/strict";
import test from "node:test";

import { createAzureCopilotRuntimeClient } from "../src/platform/azure/runtime.ts";
import { isGatewayError } from "../src/platform/azure/errors.ts";

const payload = {
  gitHubToken: `gho_${"A".repeat(36)}`,
  prompt: "Review this cookbook.",
  runId: "11111111-1111-4111-8111-111111111111",
  model: "gpt-5.4",
  maxAiCredits: 10,
};

test("Azure Copilot runtime client sends the internal shared secret and no other credential", async () => {
  let capturedRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url: String(url), init };
    return Response.json({ content: "reviewed", model: "gpt-5.4" });
  };
  try {
    const client = createAzureCopilotRuntimeClient({
      url: "https://ca-yolo-copilot.internal",
      sharedSecret: "runtime-secret-value",
    });
    const result = await client.run(payload, 5_000);
    assert.deepEqual(result, { status: 200, ok: true, body: { content: "reviewed", model: "gpt-5.4" } });
    assert.equal(capturedRequest.url, "https://ca-yolo-copilot.internal/run");
    assert.equal(capturedRequest.init.headers["x-copilot-runtime-secret"], "runtime-secret-value");
    assert.equal(JSON.stringify(capturedRequest.init).includes(payload.gitHubToken), true); // body must reach the runtime once
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Azure Copilot runtime client maps an abort timeout to a typed timeout error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  try {
    const client = createAzureCopilotRuntimeClient({ url: "https://ca-yolo-copilot.internal", sharedSecret: "s" });
    await assert.rejects(client.run(payload, 1_000), (error) => {
      assert.ok(isGatewayError(error));
      assert.equal(error.code, "copilot_runtime_timeout");
      assert.equal(error.status, 504);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Azure Copilot runtime client maps a network failure to a typed unavailable error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  try {
    const client = createAzureCopilotRuntimeClient({ url: "https://ca-yolo-copilot.internal", sharedSecret: "s" });
    await assert.rejects(client.run(payload, 1_000), (error) => {
      assert.ok(isGatewayError(error));
      assert.equal(error.code, "copilot_runtime_unavailable");
      assert.equal(error.status, 502);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Azure Copilot runtime client tolerates a non-JSON runtime response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not json", { status: 502 });
  try {
    const client = createAzureCopilotRuntimeClient({ url: "https://ca-yolo-copilot.internal", sharedSecret: "s" });
    const result = await client.run(payload, 1_000);
    assert.deepEqual(result, { status: 502, ok: false, body: null });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
