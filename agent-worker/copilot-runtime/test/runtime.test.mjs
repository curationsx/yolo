import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import test from "node:test";

import {
  buildClientOptions,
  buildSessionConfig,
  classifyCopilotError,
  createRequestHandler,
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
