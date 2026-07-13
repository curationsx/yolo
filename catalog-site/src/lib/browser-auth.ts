export const SESSION_STORAGE_KEY = 'curations.github.session';

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

export function consumeOAuthResult(): { token: string | null; error: string | null } {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('curations_session');
  const error = params.get('auth_error');
  if (token) window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  if (token || error) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }
  return { token, error };
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function beginGithubSignIn(apiBase: string): void {
  const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `${apiBase}/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`,
  );
}

export async function currentUser(apiBase: string): Promise<AuthUser | null> {
  const token = getSessionToken();
  if (!token) return null;
  const response = await fetch(`${apiBase}/api/auth/me`, {
    headers: authHeaders(),
  });
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
