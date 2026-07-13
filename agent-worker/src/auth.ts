/**
 * GitHub OAuth for the static curations.dev client.
 *
 * The browser receives only an opaque CURATIONS session token. GitHub access
 * tokens are used once to verify identity, then discarded. Sessions and OAuth
 * state live in Cloudflare KV with explicit expirations.
 */

export interface AuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS: string;
  RATE: KVNamespace;
}

export interface GithubIdentity {
  provider: "github";
  id: string;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface AuthSession {
  user: GithubIdentity;
  created_at: string;
  expires_at: string;
}

interface OAuthState {
  code_verifier: string;
  return_to: string;
}

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;
const OAUTH_STATE_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;
const OAUTH_COOKIE_NAME = "__Host-curations_oauth_state";

export function parseAllowedOrigins(raw: string): string[] {
  const origins: string[] = [];
  for (const value of raw.split(",")) {
    try {
      const origin = new URL(value.trim()).origin;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      // Invalid configured origins are ignored rather than reflected to clients.
    }
  }
  return origins;
}

export function isAllowedOrigin(origin: string, configured: string): boolean {
  let candidate: URL;
  try {
    candidate = new URL(origin);
  } catch {
    return false;
  }
  if (candidate.origin !== origin) return false;

  for (const allowedOrigin of parseAllowedOrigins(configured)) {
    const allowed = new URL(allowedOrigin);
    if (candidate.origin === allowed.origin) return true;
    if (
      allowed.protocol === "https:" &&
      allowed.hostname.endsWith(".pages.dev") &&
      candidate.protocol === allowed.protocol &&
      candidate.port === allowed.port &&
      candidate.hostname.endsWith(`.${allowed.hostname}`)
    ) {
      return true;
    }
  }
  return false;
}

export function resolvedAllowedOrigin(
  origin: string,
  configured: string,
  fallback = "https://curations.dev",
): string {
  if (isAllowedOrigin(origin, configured)) return origin;
  return parseAllowedOrigins(configured)[0] ?? fallback;
}

function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeReturnTo(raw: string | null, env: AuthEnv): string {
  const origins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const fallback = `${origins[0] ?? "https://curations.dev"}/`;
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    return isAllowedOrigin(url.origin, env.ALLOWED_ORIGINS)
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

function callbackUrl(req: Request): string {
  return `${new URL(req.url).origin}/api/auth/github/callback`;
}

function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

function oauthCookie(value: string, maxAge: number): string {
  return `${OAUTH_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function redirectWithCookie(url: URL, cookie: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      "set-cookie": cookie,
    },
  });
}

function errorRedirect(returnTo: string, code: string): Response {
  const url = new URL(returnTo);
  url.hash = new URLSearchParams({ auth_error: code }).toString();
  return redirectWithCookie(url, oauthCookie("", 0));
}

export function githubAuthConfigured(env: AuthEnv): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

export function bearerToken(req: Request): string | null {
  const match = req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const token = match?.[1] ?? null;
  return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

export async function getSession(req: Request, env: AuthEnv): Promise<AuthSession | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const session = await env.RATE.get<AuthSession>(`session:${token}`, "json");
  if (!session) return null;
  if (Date.parse(session.expires_at) <= Date.now()) {
    await env.RATE.delete(`session:${token}`);
    return null;
  }
  return session;
}

export async function beginGithubAuth(req: Request, env: AuthEnv): Promise<Response> {
  if (!githubAuthConfigured(env)) {
    return new Response("GitHub sign-in is not configured yet.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const requestUrl = new URL(req.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get("return_to"), env);
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = await sha256Base64Url(verifier);
  const stateValue: OAuthState = { code_verifier: verifier, return_to: returnTo };
  await env.RATE.put(`oauth:${state}`, JSON.stringify(stateValue), {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
  });

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", callbackUrl(req));
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return redirectWithCookie(authorize, oauthCookie(state, OAUTH_STATE_TTL_SECONDS));
}

export async function finishGithubAuth(req: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const cookieState = readCookie(req, OAUTH_COOKIE_NAME) ?? "";
  if (
    !OAUTH_STATE_PATTERN.test(state) ||
    !OAUTH_STATE_PATTERN.test(cookieState) ||
    state !== cookieState
  ) {
    return errorRedirect(safeReturnTo(null, env), "state_mismatch");
  }

  const saved = await env.RATE.get<OAuthState>(`oauth:${state}`, "json");
  if (saved) await env.RATE.delete(`oauth:${state}`);

  const returnTo = safeReturnTo(saved?.return_to ?? null, env);
  if (!saved || url.searchParams.get("error")) return errorRedirect(returnTo, "github_denied");

  const code = url.searchParams.get("code");
  if (!code) return errorRedirect(returnTo, "missing_code");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "curations-dev-agent-gateway",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(req),
      code_verifier: saved.code_verifier,
    }),
  });
  if (!tokenResponse.ok) return errorRedirect(returnTo, "token_exchange_failed");
  const tokenBody = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenBody.access_token) return errorRedirect(returnTo, "token_exchange_failed");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${tokenBody.access_token}`,
      "user-agent": "curations-dev-agent-gateway",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!userResponse.ok) return errorRedirect(returnTo, "identity_lookup_failed");
  const github = (await userResponse.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
  };

  const sessionToken = randomToken(36);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_SECONDS * 1000);
  const session: AuthSession = {
    user: {
      provider: "github",
      id: String(github.id),
      login: github.login,
      name: github.name,
      avatar_url: github.avatar_url,
      html_url: github.html_url,
    },
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
  await env.RATE.put(`session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  const destination = new URL(returnTo);
  destination.hash = new URLSearchParams({ curations_session: sessionToken }).toString();
  return redirectWithCookie(destination, oauthCookie("", 0));
}

export async function endSession(req: Request, env: AuthEnv): Promise<void> {
  const token = bearerToken(req);
  if (token) await env.RATE.delete(`session:${token}`);
}
