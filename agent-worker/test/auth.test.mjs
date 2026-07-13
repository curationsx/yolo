import assert from "node:assert/strict";
import test from "node:test";

import {
  bearerToken,
  beginCopilotGithubAuth,
  beginGithubAuth,
  copilotAuthConfigured,
  endSession,
  finishGithubAuth,
  getSession,
  issueCopilotAuthorization,
} from "../src/auth.ts";
import { decryptCopilotToken } from "../src/copilot-grant.ts";

class MemoryKv {
  values = new Map();
  deleted = [];

  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return type === "json" && value ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.deleted.push(key);
    this.values.delete(key);
  }
}

function authEnv(rate = new MemoryKv()) {
  return {
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    ALLOWED_ORIGINS:
      "http://localhost:4321,https://curations.dev,https://curations-dev.pages.dev",
    RATE: rate,
  };
}

class MemoryCopilotGrantStore {
  values = new Map();

  async put(sessionToken, grant) {
    this.values.set(sessionToken, grant);
  }

  async consume(sessionToken) {
    const grant = this.values.get(sessionToken);
    if (!grant) return null;
    this.values.delete(sessionToken);
    return grant;
  }

  async status(sessionToken) {
    const grant = this.values.get(sessionToken);
    return grant
      ? { connected: true, expires_at: grant.expires_at }
      : { connected: false, expires_at: null };
  }

  async revoke(sessionToken) {
    this.values.delete(sessionToken);
  }
}

function copilotEnv(rate = new MemoryKv(), grants = new MemoryCopilotGrantStore()) {
  return {
    ...authEnv(rate),
    copilotGrants: grants,
    COPILOT_CONNECTION_TTL_SECONDS: "600",
    COPILOT_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64url"),
  };
}

test("bearerToken accepts only opaque CURATIONS session tokens", () => {
  const token = "A".repeat(40);
  assert.equal(
    bearerToken(new Request("https://api.curations.dev", {
      headers: { authorization: `Bearer ${token}` },
    })),
    token,
  );
  assert.equal(
    bearerToken(new Request("https://api.curations.dev", {
      headers: { authorization: "Bearer short" },
    })),
    null,
  );
  assert.equal(
    bearerToken(new Request("https://api.curations.dev", {
      headers: { authorization: `Basic ${token}` },
    })),
    null,
  );
});

test("GitHub OAuth uses PKCE, read:user, and a safe return URL", async () => {
  const rate = new MemoryKv();
  const response = await beginGithubAuth(
    new Request(
      "https://api.curations.dev/api/auth/github/start?return_to=https%3A%2F%2Fevil.example%2Fsteal",
    ),
    authEnv(rate),
  );

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin, "https://github.com");
  assert.equal(location.pathname, "/login/oauth/authorize");
  assert.equal(location.searchParams.get("scope"), "read:user");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.match(location.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{40,80}$/);
  assert.equal(
    location.searchParams.get("redirect_uri"),
    "https://api.curations.dev/api/auth/github/callback",
  );

  const state = location.searchParams.get("state");
  assert.match(state, /^[A-Za-z0-9_-]{40,80}$/);
  const saved = JSON.parse(rate.values.get(`oauth:${state}`));
  assert.equal(saved.return_to, "http://localhost:4321/");
  assert.match(saved.code_verifier, /^[A-Za-z0-9_-]{40,80}$/);
  assert.match(
    response.headers.get("set-cookie"),
    /^__Host-curations_oauth_state=.*HttpOnly; Secure; SameSite=Lax$/,
  );
});

test("GitHub OAuth accepts Cloudflare Pages branch return URLs", async () => {
  const rate = new MemoryKv();
  const returnTo =
    "https://feat-catalog-site.curations-dev.pages.dev/software/cloudflare/";
  const response = await beginGithubAuth(
    new Request(
      `https://api.curations.dev/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`,
    ),
    authEnv(rate),
  );

  const location = new URL(response.headers.get("location"));
  const state = location.searchParams.get("state");
  const saved = JSON.parse(rate.values.get(`oauth:${state}`));
  assert.equal(saved.return_to, returnTo);
});

test("expired sessions are deleted and rejected", async () => {
  const rate = new MemoryKv();
  const token = "B".repeat(40);
  rate.values.set(
    `session:${token}`,
    JSON.stringify({
      user: {
        provider: "github",
        id: "123",
        login: "curator",
        name: null,
        avatar_url: "https://avatars.example/123",
        html_url: "https://github.com/curator",
      },
      created_at: "2020-01-01T00:00:00.000Z",
      expires_at: "2020-01-02T00:00:00.000Z",
    }),
  );

  const session = await getSession(
    new Request("https://api.curations.dev/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    }),
    authEnv(rate),
  );

  assert.equal(session, null);
  assert.deepEqual(rate.deleted, [`session:${token}`]);
});

test("OAuth callback stores an opaque session and discards the GitHub token", async () => {
  const rate = new MemoryKv();
  const state = "S".repeat(48);
  rate.values.set(
    `oauth:${state}`,
    JSON.stringify({
      code_verifier: "V".repeat(64),
      return_to: "http://localhost:4321/software/cloudflare/",
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: "github-secret-token" });
    }
    if (String(url) === "https://api.github.com/user") {
      return Response.json({
        id: 123,
        login: "test-curator",
        name: "Test Curator",
        avatar_url: "https://avatars.example/test-curator",
        html_url: "https://github.com/test-curator",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const response = await finishGithubAuth(
      new Request(
        `https://api.curations.dev/api/auth/github/callback?code=oauth-code&state=${state}`,
        { headers: { cookie: `__Host-curations_oauth_state=${state}` } },
      ),
      authEnv(rate),
    );
    assert.equal(response.status, 302);

    const location = new URL(response.headers.get("location"));
    assert.equal(
      `${location.origin}${location.pathname}`,
      "http://localhost:4321/software/cloudflare/",
    );
    const sessionToken = new URLSearchParams(location.hash.slice(1)).get(
      "curations_session",
    );
    assert.match(sessionToken, /^[A-Za-z0-9_-]{40,80}$/);

    const stored = rate.values.get(`session:${sessionToken}`);
    assert.ok(stored);
    assert.equal(stored.includes("github-secret-token"), false);
    assert.equal(rate.values.has(`oauth:${state}`), false);

    const authenticatedRequest = new Request(
      "https://api.curations.dev/api/auth/me",
      { headers: { authorization: `Bearer ${sessionToken}` } },
    );
    const session = await getSession(authenticatedRequest, authEnv(rate));
    assert.equal(session.user.login, "test-curator");

    await endSession(authenticatedRequest, authEnv(rate));
    assert.equal(rate.values.has(`session:${sessionToken}`), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Use My Copilot issues a session-bound OAuth flow", async () => {
  const rate = new MemoryKv();
  const env = copilotEnv(rate);
  const sessionToken = "C".repeat(48);
  rate.values.set(
    `session:${sessionToken}`,
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
  assert.equal(copilotAuthConfigured(env), true);

  const ticket = await issueCopilotAuthorization(
    new Request("https://api.curations.dev/api/copilot/connect", {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        return_to:
          "https://curations.dev/cookbooks/?run=pre-mortem&stack=cloudflare",
      }),
    }),
    env,
  );
  assert.equal(ticket.ok, true);

  const authorization = await beginCopilotGithubAuth(
    new Request(ticket.authorize_url),
    env,
  );
  assert.equal(authorization.status, 302);
  const location = new URL(authorization.headers.get("location"));
  assert.equal(location.searchParams.get("scope"), "read:user");
  assert.equal(location.searchParams.get("prompt"), "select_account");
  const state = location.searchParams.get("state");
  const saved = JSON.parse(rate.values.get(`oauth:${state}`));
  assert.equal(saved.purpose, "copilot");
  assert.equal(saved.session_token, sessionToken);
  assert.equal(saved.user_id, "123");
});

test("Copilot OAuth callback stores one encrypted grant without replacing identity", async () => {
  const rate = new MemoryKv();
  const grants = new MemoryCopilotGrantStore();
  const env = copilotEnv(rate, grants);
  const sessionToken = "D".repeat(48);
  const state = "P".repeat(48);
  const returnTo =
    "https://curations.dev/cookbooks/?run=pre-mortem&stack=cloudflare";
  rate.values.set(
    `session:${sessionToken}`,
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
  rate.values.set(
    `oauth:${state}`,
    JSON.stringify({
      code_verifier: "V".repeat(64),
      return_to: returnTo,
      purpose: "copilot",
      session_token: sessionToken,
      user_id: "123",
    }),
  );
  const githubToken = `gho_${"Z".repeat(36)}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: githubToken });
    }
    if (String(url) === "https://api.github.com/user") {
      return Response.json({
        id: 123,
        login: "test-curator",
        name: "Test Curator",
        avatar_url: "https://avatars.example/test-curator",
        html_url: "https://github.com/test-curator",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const response = await finishGithubAuth(
      new Request(
        `https://api.curations.dev/api/auth/github/callback?code=oauth-code&state=${state}`,
        { headers: { cookie: `__Host-curations_oauth_state=${state}` } },
      ),
      env,
    );
    assert.equal(response.status, 302);
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.hash, "#copilot_connected=1");
    assert.equal(destination.searchParams.get("run"), "pre-mortem");

    const grant = grants.values.get(sessionToken);
    assert.ok(grant);
    assert.equal(JSON.stringify(grant).includes(githubToken), false);
    assert.equal(
      await decryptCopilotToken(grant, env.COPILOT_TOKEN_ENCRYPTION_KEY),
      githubToken,
    );
    assert.ok(rate.values.has(`session:${sessionToken}`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
