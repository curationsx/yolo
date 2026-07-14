import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import test from "node:test";

import {
  buildClientOptions,
  buildSessionConfig,
  classifyCopilotError,
  createRequestHandler,
  isRuntimeRequestAuthorized,
  validateRunPayload,
} from "../server.mjs";
import { createServer } from "node:http";

const validPayload = {
  gitHubToken: `gho_${"A".repeat(36)}`,
  prompt: "Review this versioned cookbook.",
  runId: "11111111-1111-4111-8111-111111111111",
  model: "gpt-5.4",
  maxAiCredits: 10,
};

test("runtime client and session disable ambient capabilities", () => {
  const client = buildClientOptions();
  assert.equal(client.mode, "empty");
  assert.equal(client.useLoggedInUser, false);

  const session = buildSessionConfig(validPayload);
  assert.deepEqual(session.availableTools, []);
  assert.deepEqual(session.tools, []);
  assert.deepEqual(session.mcpServers, {});
  assert.equal(session.skipCustomInstructions, true);
  assert.equal(session.enableHostGitOperations, false);
  assert.equal(session.enableSessionStore, false);
  assert.equal(session.enableSkills, false);
  assert.deepEqual(session.memory, { enabled: false });
  assert.deepEqual(session.sessionLimits, { maxAiCredits: 10 });
  assert.deepEqual(session.onPermissionRequest(), {
    kind: "reject",
    feedback: "CURATIONS embedded runs do not permit tools.",
  });
});

test("runtime validates bounded one-run payloads", () => {
  assert.deepEqual(validateRunPayload(validPayload), validPayload);
  assert.equal(validateRunPayload({ ...validPayload, gitHubToken: "bad" }), null);
  assert.equal(validateRunPayload({ ...validPayload, prompt: "" }), null);
  assert.equal(validateRunPayload({ ...validPayload, maxAiCredits: 51 }), null);
  assert.equal(validateRunPayload({ ...validPayload, model: "../escape" }), null);
});

test("runtime maps authorization and budget failures without leaking details", () => {
  assert.deepEqual(classifyCopilotError(new Error("HTTP 401 secret detail")), {
    status: 401,
    code: "copilot_authorization_failed",
    error: "GitHub could not authorize this Copilot run.",
  });
  assert.deepEqual(classifyCopilotError(new Error("AI credit budget exceeded")), {
    status: 429,
    code: "copilot_limit_reached",
    error: "Your GitHub Copilot plan or budget cannot complete this run.",
  });
});

test("HTTP boundary returns a response without echoing the delegated token", async (context) => {
  const server = createServer(
    createRequestHandler(async (payload) => ({
      content: `Reviewed ${payload.runId}`,
      model: payload.model,
    })),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const body = JSON.stringify(validPayload);
  const response = await new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path: "/run",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      async (res) => {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        resolve({
          status: res.statusCode,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });

  assert.equal(response.status, 200);
  assert.match(response.text, /Reviewed 11111111/);
  assert.equal(response.text.includes(validPayload.gitHubToken), false);
});

test("isRuntimeRequestAuthorized allows any request when no shared secret is configured", () => {
  assert.equal(isRuntimeRequestAuthorized({ headers: {} }, undefined), true);
  assert.equal(isRuntimeRequestAuthorized({ headers: {} }, ""), true);
});

test("isRuntimeRequestAuthorized requires a matching shared secret when configured", () => {
  const secret = "runtime-shared-secret-value";
  assert.equal(
    isRuntimeRequestAuthorized({ headers: { "x-copilot-runtime-secret": secret } }, secret),
    true,
  );
  assert.equal(
    isRuntimeRequestAuthorized({ headers: { "x-copilot-runtime-secret": "wrong" } }, secret),
    false,
  );
  assert.equal(isRuntimeRequestAuthorized({ headers: {} }, secret), false);
  assert.equal(
    isRuntimeRequestAuthorized({ headers: { "x-copilot-runtime-secret": "short" } }, secret),
    false,
  );
});

function postJson(server, path, body, headers = {}) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      async (res) => {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

test("the internal runtime rejects requests without the shared secret", async (context) => {
  const secret = "top-secret-runtime-value";
  const server = createServer(
    createRequestHandler(async (payload) => ({ content: `Reviewed ${payload.runId}`, model: payload.model }), secret),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const unauthorized = await postJson(server, "/run", validPayload);
  assert.equal(unauthorized.status, 401);
  assert.equal(JSON.parse(unauthorized.text).code, "runtime_unauthorized");
  assert.equal(unauthorized.text.includes(secret), false);

  const wrongSecret = await postJson(server, "/run", validPayload, {
    "x-copilot-runtime-secret": "not-the-secret",
  });
  assert.equal(wrongSecret.status, 401);

  const authorized = await postJson(server, "/run", validPayload, {
    "x-copilot-runtime-secret": secret,
  });
  assert.equal(authorized.status, 200);
});

test("health checks never require the shared secret", async (context) => {
  const secret = "another-runtime-secret";
  const server = createServer(createRequestHandler(async () => ({ content: "x", model: "m" }), secret));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const response = await new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port: server.address().port, path: "/health", method: "GET" },
      async (res) => {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") });
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.text), { ok: true, mode: "empty", tools: 0 });
});

test("runtime timeout is classified without leaking run details", () => {
  assert.deepEqual(classifyCopilotError(new Error("Copilot session timed out")), {
    status: 504,
    code: "copilot_timeout",
    error: "GitHub Copilot did not finish before the run timed out.",
  });
});

