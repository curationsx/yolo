export const SESSION_STORAGE_KEY = 'curations.github.session';
const COPILOT_NOTICE_KEY = 'curations.copilot.notice';
const AUTH_RETRY_DELAYS_MS = [0, 500, 1_000, 2_000, 4_000, 8_000, 12_000, 16_000] as const;
const TRANSIENT_AUTH_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

export interface AuthRetryNotice {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  status: number | null;
}

export interface AuthRequestOptions {
  retryDelaysMs?: readonly number[];
  onRetry?: (notice: AuthRetryNotice) => void;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface AuthUser {
  provider: 'github';
  id: string;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export function getSessionToken(): string | null {
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export interface OAuthResult {
  token: string | null;
  error: string | null;
  copilotConnected: boolean;
  copilotError: string | null;
}

export function clearCopilotNotice(): void {
  window.sessionStorage.removeItem(COPILOT_NOTICE_KEY);
}

export function consumeOAuthResult(): OAuthResult {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('curations_session');
  const error = params.get('auth_error');
  const copilotConnected = params.get('copilot_connected') === '1';
  const copilotError = params.get('copilot_error');
  if (token) window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  if (copilotConnected || copilotError) {
    window.sessionStorage.setItem(
      COPILOT_NOTICE_KEY,
      JSON.stringify({ copilotConnected, copilotError }),
    );
  }
  if (token || error || copilotConnected || copilotError) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }
  if (!copilotConnected && !copilotError) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(COPILOT_NOTICE_KEY) ?? '{}') as {
        copilotConnected?: boolean;
        copilotError?: string | null;
      };
      return {
        token,
        error,
        copilotConnected: saved.copilotConnected === true,
        copilotError: saved.copilotError ?? null,
      };
    } catch {
      clearCopilotNotice();
    }
  }
  return { token, error, copilotConnected, copilotError };
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchAuthResponse(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: AuthRequestOptions = {},
): Promise<Response> {
  const delays = options.retryDelaysMs ?? AUTH_RETRY_DELAYS_MS;
  if (delays.length === 0) throw new Error('Auth retry schedule must include an initial attempt');
  const fetcher = options.fetcher ?? globalThis.fetch;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delays[attempt]));
    }

    try {
      const response = await fetcher(input, init);
      if (response.ok || !TRANSIENT_AUTH_STATUSES.has(response.status)) return response;
      if (attempt === delays.length - 1) return response;
      options.onRetry?.({
        attempt: attempt + 2,
        maxAttempts: delays.length,
        delayMs: delays[attempt + 1],
        status: response.status,
      });
    } catch (error) {
      if (attempt === delays.length - 1) throw error;
      options.onRetry?.({
        attempt: attempt + 2,
        maxAttempts: delays.length,
        delayMs: delays[attempt + 1],
        status: null,
      });
    }
  }

  throw new Error('Identity gateway retry schedule exhausted');
}

export function beginGithubSignIn(apiBase: string, requestedReturnTo?: string): void {
  clearCopilotNotice();
  const returnTo =
    requestedReturnTo ??
    `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `${apiBase}/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`,
  );
}

export async function currentUser(
  apiBase: string,
  requestOptions: AuthRequestOptions = {},
): Promise<AuthUser | null> {
  const token = getSessionToken();
  if (!token) return null;
  const response = await fetchAuthResponse(
    `${apiBase}/api/auth/me`,
    { headers: authHeaders() },
    requestOptions,
  );
  if (response.status === 401) {
    clearSession();
    return null;
  }
  if (!response.ok) throw new Error(`identity lookup failed: ${response.status}`);
  const body = (await response.json()) as { user: AuthUser | null };
  return body.user;
}

export function broadcastAuth(user: AuthUser | null): void {
  document.dispatchEvent(new CustomEvent('curations:auth', { detail: { user } }));
}
