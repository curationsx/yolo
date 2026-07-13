import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

import { buildAzureEnv, startAzureGateway } from "../src/platform/azure/server.ts";
import { loadAzureConfig } from "../src/platform/azure/config.ts";
import { FakeCosmosContainer } from "./helpers/fake-cosmos-container.mjs";

function validEnv(overrides = {}) {
  return {
    ALLOWED_ORIGINS: "https://curations.dev,http://localhost:4321",
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
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    COPILOT_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64url"),
    PORT: "0",
    ...overrides,
  };
}

function fakeCosmosClient() {
  const containers = new Map();
  const database = {
    container: (name) => {
      let container = containers.get(name);
      if (!container) {
        container = new FakeCosmosContainer(name === "votes" ? "target_id" : name === "gateway-state" ? "scope" : "tool_id");
        containers.set(name, container);
      }
      return container;
    },
  };
  return { database: () => database, containers };
}

function fakeCredential(token = "fake-token") {
  return { getToken: async () => (token ? { token, expiresOnTimestamp: Date.now() + 60_000 } : null) };
}

test("buildAzureEnv wires every Azure adapter into one project-owned Env", () => {
  const config = loadAzureConfig(validEnv());
  const env = buildAzureEnv(config, fakeCosmosClient(), fakeCredential());
  assert.equal(typeof env.quota.reserve, "function");
  assert.equal(typeof env.copilotGrants.consume, "function");
  assert.equal(typeof env.votes.setVote, "function");
  assert.equal(typeof env.community.readDocument, "function");
  assert.equal(typeof env.agentModel.chat, "function");
  assert.equal(typeof env.copilotRuntime.run, "function");
  assert.equal(typeof env.readiness.check, "function");
});

test("requestMetadata trusts only the rightmost X-Forwarded-For entry", () => {
  const config = loadAzureConfig(validEnv());
  const env = buildAzureEnv(config, fakeCosmosClient(), fakeCredential());

  const spoofed = new Request("https://api.curations.dev/api/health", {
    headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.5" },
  });
  // Azure Container Apps appends its own observed address last; anything a
  // client supplies before it (like a spoofed first hop) is untrusted.
  assert.equal(env.requestMetadata.clientIp(spoofed), "10.0.0.5");

  const single = new Request("https://api.curations.dev/api/health", {
    headers: { "x-forwarded-for": "203.0.113.7" },
  });
  assert.equal(env.requestMetadata.clientIp(single), "203.0.113.7");

  const missing = new Request("https://api.curations.dev/api/health");
  assert.equal(env.requestMetadata.clientIp(missing), "unknown");
});

async function fetchFrom(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
}

test("the Node/Azure gateway serves liveness, readiness, and health over real HTTP", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential());
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const live = await fetchFrom(port, "/api/live");
  assert.equal(live.status, 200);
  assert.deepEqual(live.body, { ok: true });

  const ready = await fetchFrom(port, "/api/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.ready, true);
  assert.equal(ready.body.checks.cosmos, "ok");
  assert.equal(ready.body.checks.foundry, "ok");

  const health = await fetchFrom(port, "/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.model, "gpt-5.4-mini");

  const authConfig = await fetchFrom(port, "/api/auth/config");
  assert.equal(authConfig.status, 200);
  assert.equal(authConfig.body.github, true);
});

test("the Node/Azure gateway reports not-ready when a dependency check fails", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential(null));
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const ready = await fetchFrom(port, "/api/ready");
  assert.equal(ready.status, 503);
  assert.equal(ready.body.ready, false);
  assert.equal(ready.body.checks.foundry, "error");
});

test("the Node/Azure gateway rejects oversized request bodies with a typed 413", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential());
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const oversized = "x".repeat(400_000);
  const response = await fetch(`http://127.0.0.1:${port}/api/discussions`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://curations.dev" },
    body: oversized,
  });
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.code, "payload_too_large");
});

test("the Node/Azure gateway never logs the delegated GitHub token or prompt content", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential());
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const secretToken = `gho_${"S".repeat(36)}`;
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (line) => lines.push(String(line));
  console.error = (line) => lines.push(String(line));
  try {
    await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { authorization: `Bearer ${secretToken}`, origin: "https://curations.dev" },
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(lines.some((line) => line.includes(secretToken)), false);
});

test("the Node/Azure gateway attaches a correlation id header without leaking it as a secret", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential());
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const response = await fetch(`http://127.0.0.1:${port}/api/live`);
  assert.equal(response.status, 200);
});

test("a typed GatewayError thrown by a store propagates to a matching HTTP response", async (context) => {
  const config = loadAzureConfig(validEnv());
  const cosmosClient = fakeCosmosClient();
  const credential = fakeCredential();
  const env = buildAzureEnv(config, cosmosClient, credential);
  const server = startAzureGateway(config, cosmosClient, credential);
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const token = "T".repeat(48);
  await env.RATE.put(
    `session:${token}`,
    JSON.stringify({
      user: {
        provider: "github",
        id: "123",
        login: "test-curator",
        name: "Test Curator",
        avatar_url: "https://avatars.example/test-curator",
        html_url: "https://github.com/test-curator",
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    { expirationTtl: 3600 },
  );
  // Ensure the daily quota document already exists, then force every
  // subsequent conditional replace to conflict so retries are exhausted —
  // `env.quota.reserve` (uncaught by community.ts here) throws a
  // `GatewayError` that must reach the client as a matching HTTP response.
  await env.quota.reserve([{ key: "community:thread:123", limit: 8 }]);
  const gatewayState = cosmosClient.containers.get("gateway-state");
  for (let i = 0; i < 20; i += 1) gatewayState.failNext("replace", 412);

  const response = await fetch(`http://127.0.0.1:${port}/api/discussions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "https://curations.dev",
    },
    body: JSON.stringify({
      tool_id: "cloudflare",
      title: "A title with enough characters",
      body: "A discussion body with enough characters to pass validation.",
      invite_agent: false,
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "dependency_throttled");
});

test("an unexpected (non-GatewayError) failure produces a safe generic 500", async (context) => {
  const config = loadAzureConfig(validEnv());
  const cosmosClient = fakeCosmosClient();
  const credential = fakeCredential();
  const env = buildAzureEnv(config, cosmosClient, credential);
  const server = startAzureGateway(config, cosmosClient, credential);
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const token = "U".repeat(48);
  await env.RATE.put(
    `session:${token}`,
    JSON.stringify({
      user: {
        provider: "github",
        id: "123",
        login: "test-curator",
        name: "Test Curator",
        avatar_url: "https://avatars.example/test-curator",
        html_url: "https://github.com/test-curator",
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    { expirationTtl: 3600 },
  );
  // `handleCopilotRun` reads grant status before any try/catch wraps it — an
  // ordinary (non-GatewayError) Cosmos failure there must still surface as a
  // safe, generic 500 rather than crashing the process or leaking detail.
  cosmosClient.containers.get("gateway-state").failNext("read", 500);

  const response = await fetch(`http://127.0.0.1:${port}/api/copilot/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "https://curations.dev",
    },
    body: JSON.stringify({
      prompt_path: "/copilot/pre-mortem/v1.2/cloudflare.txt",
      run_id: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, "internal_error");
});

test("running server.ts directly boots the real process entrypoint and serves requests", async (context) => {
  const workerRoot = new URL("../", import.meta.url).pathname;
  const port = 32100 + Math.floor(Math.random() * 1000);
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "src/platform/azure/server.ts"],
    {
      cwd: workerRoot,
      env: { ...process.env, ...validEnv({ PORT: String(port) }) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));
  context.after(async () => {
    if (child.exitCode === null && child.pid) {
      process.kill(child.pid, "SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    }
  });

  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/live`);
      assert.equal(response.status, 200);
      return;
    } catch (error) {
      lastError = error;
      if (child.exitCode !== null) {
        throw new Error(`server process exited early (${child.exitCode}):\n${output}`);
      }
    }
  }
  throw new Error(`server never became reachable: ${lastError}\n${output}`);
});

test("running server.ts directly fails fast on invalid configuration", async () => {
  const workerRoot = new URL("../", import.meta.url).pathname;
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "src/platform/azure/server.ts"],
    {
      cwd: workerRoot,
      env: { ...process.env, ALLOWED_ORIGINS: "", COSMOS_ENDPOINT: "", COSMOS_DATABASE: "" },
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /config_invalid|GatewayError/);
});

test("an error while converting the Node request itself is logged and answered safely", async (context) => {
  const config = loadAzureConfig(validEnv());
  const server = startAzureGateway(config, fakeCosmosClient(), fakeCredential());
  context.after(() => server.close());
  await server.ready;
  const port = server.address().port;

  const originalSet = Headers.prototype.set;
  Headers.prototype.set = function patchedSet(key, value) {
    if (String(key).toLowerCase() === "x-force-header-error") {
      throw new Error("simulated header failure");
    }
    return originalSet.call(this, key, value);
  };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/live`, {
      headers: { "x-force-header-error": "boom" },
    });
    assert.equal(response.status, 500);
  } finally {
    Headers.prototype.set = originalSet;
  }
});
