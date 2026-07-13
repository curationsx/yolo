import assert from "node:assert/strict";
import test from "node:test";

import { encryptCopilotToken } from "../src/copilot-grant.ts";
import { handleCopilotRun, handleCopilotStatus } from "../src/copilot.ts";

class MemoryKv {
  values = new Map();

  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async delete(key) {
    this.values.delete(key);
  }
}

class AllowingQuotaNamespace {
  actions = [];

  idFromName(name) {
    return name;
  }

  get() {
    return {
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body);
        this.actions.push(body.action ?? "reserve");
        return Response.json({ allowed: true });
      },
    };
  }
}

class GrantNamespace {
  values = new Map();

  idFromName(name) {
    return name;
  }

  get(id) {
    return {
      fetch: async (url) => {
        const path = new URL(url).pathname;
        const grant = this.values.get(id);
        if (!grant) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        if (path === "/status") {
          return Response.json({
            connected: true,
            expires_at: grant.expires_at,
          });
        }
        if (path === "/consume") {
          this.values.delete(id);
          return Response.json(grant);
        }
        return Response.json({ error: "not found" }, { status: 404 });
      },
    };
  }
}

class RacingGrantNamespace {
  idFromName(name) {
    return name;
  }

  get() {
    return {
      fetch: async (url) => {
        const path = new URL(url).pathname;
        if (path === "/status") {
          return Response.json({
            connected: true,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          });
        }
        return Response.json({ error: "not found" }, { status: 404 });
      },
    };
  }
}

class RuntimeNamespace {
  requests = [];

  idFromName(name) {
    return name;
  }

  get() {
    return {
      fetch: async (request) => {
        this.requests.push(await request.json());
        return Response.json({
          content: "AI · GITHUB COPILOT SDK\n\nHUMAN DECISION NEEDED",
          model: "gpt-5.4",
        });
      },
    };
  }
}

function copilotEnv() {
  return {
    ALLOWED_ORIGINS:
      "https://curations.dev,https://curations-dev.pages.dev,http://localhost:4321",
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    COPILOT_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString("base64url"),
    COPILOT_MODEL: "gpt-5.4",
    COPILOT_MAX_AI_CREDITS: "10",
    RATE: new MemoryKv(),
    QUOTA: new AllowingQuotaNamespace(),
    COPILOT_GRANT: new GrantNamespace(),
    COPILOT_RUNTIME: new RuntimeNamespace(),
  };
}

function addSession(env, token = "S".repeat(48)) {
  env.RATE.values.set(
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
  );
  return token;
}

test("Copilot status exposes only connection state and bounded runtime metadata", async () => {
  const env = copilotEnv();
  const sessionToken = addSession(env);
  const grant = await encryptCopilotToken(
    `gho_${"A".repeat(36)}`,
    "123",
    new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    env.COPILOT_TOKEN_ENCRYPTION_KEY,
  );
  env.COPILOT_GRANT.values.set(sessionToken, grant);

  const response = await handleCopilotStatus(
    new Request("https://api.curations.dev/api/copilot/status", {
      headers: { authorization: `Bearer ${sessionToken}` },
    }),
    env,
    {},
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.connected, true);
  assert.equal(payload.model, "gpt-5.4");
  assert.equal(payload.max_ai_credits, 10);
  assert.equal(JSON.stringify(payload).includes("gho_"), false);
});

test("Copilot run consumes the grant and sends one bounded request to the private runtime", async () => {
  const env = copilotEnv();
  const sessionToken = addSession(env);
  const githubToken = `gho_${"B".repeat(36)}`;
  const grant = await encryptCopilotToken(
    githubToken,
    "123",
    new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    env.COPILOT_TOKEN_ENCRYPTION_KEY,
  );
  env.COPILOT_GRANT.values.set(sessionToken, grant);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (
      String(url) ===
      "https://curations.dev/copilot/pre-mortem/v1.2/cloudflare.txt"
    ) {
      return new Response("Versioned cookbook prompt", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const response = await handleCopilotRun(
      new Request("https://api.curations.dev/api/copilot/run", {
        method: "POST",
        headers: {
          authorization: `Bearer ${sessionToken}`,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.8",
          origin: "https://curations.dev",
        },
        body: JSON.stringify({
          prompt_path: "/copilot/pre-mortem/v1.2/cloudflare.txt",
          instruction: "Stress-test rollback assumptions.",
          run_id: "123e4567-e89b-12d3-a456-426614174000",
        }),
      }),
      env,
      {},
    );
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.billing, "github-copilot-user");
    assert.equal(JSON.stringify(payload).includes(githubToken), false);
    assert.equal(env.COPILOT_GRANT.values.has(sessionToken), false);
    assert.equal(env.COPILOT_RUNTIME.requests.length, 1);
    assert.equal(env.COPILOT_RUNTIME.requests[0].gitHubToken, githubToken);
    assert.match(
      env.COPILOT_RUNTIME.requests[0].prompt,
      /Stress-test rollback assumptions\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Copilot run restores daily capacity when the one-run grant loses a race", async () => {
  const env = copilotEnv();
  const sessionToken = addSession(env);
  env.COPILOT_GRANT = new RacingGrantNamespace();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (
      String(url) ===
      "https://curations.dev/copilot/pre-mortem/v1.2/cloudflare.txt"
    ) {
      return new Response("Versioned cookbook prompt", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const response = await handleCopilotRun(
      new Request("https://api.curations.dev/api/copilot/run", {
        method: "POST",
        headers: {
          authorization: `Bearer ${sessionToken}`,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.8",
          origin: "https://curations.dev",
        },
        body: JSON.stringify({
          prompt_path: "/copilot/pre-mortem/v1.2/cloudflare.txt",
          instruction: "",
          run_id: "123e4567-e89b-12d3-a456-426614174000",
        }),
      }),
      env,
      {},
    );
    assert.equal(response.status, 409);
    assert.deepEqual(env.QUOTA.actions, ["reserve", "release"]);
    assert.equal(env.COPILOT_RUNTIME.requests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
