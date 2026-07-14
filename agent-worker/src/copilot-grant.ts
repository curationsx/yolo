export interface EncryptedCopilotGrant {
  version: 1;
  user_id: string;
  iv: string;
  ciphertext: string;
  expires_at: string;
}

interface CopilotGrantEnv {
  COPILOT_GRANT: DurableObjectNamespace;
}

const GRANT_KEY = "grant";
const USER_ID_PATTERN = /^\d+$/;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;
const ENCRYPTION_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_]{20,255}$/;

function isGrant(value: unknown): value is EncryptedCopilotGrant {
  if (!value || typeof value !== "object") return false;
  const grant = value as Partial<EncryptedCopilotGrant>;
  return (
    grant.version === 1 &&
    typeof grant.user_id === "string" &&
    USER_ID_PATTERN.test(grant.user_id) &&
    typeof grant.iv === "string" &&
    /^[A-Za-z0-9_-]{16}$/.test(grant.iv) &&
    typeof grant.ciphertext === "string" &&
    /^[A-Za-z0-9_-]{20,1024}$/.test(grant.ciphertext) &&
    typeof grant.expires_at === "string" &&
    Number.isFinite(Date.parse(grant.expires_at))
  );
}

function grantNamespace(env: CopilotGrantEnv, sessionToken: string) {
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    throw new Error("invalid CURATIONS session token");
  }
  const id = env.COPILOT_GRANT.idFromName(sessionToken);
  return env.COPILOT_GRANT.get(id);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function additionalData(userId: string, expiresAt: string): Uint8Array {
  return new TextEncoder().encode(`curations-copilot-v1\n${userId}\n${expiresAt}`);
}

async function importEncryptionKey(
  encodedKey: string,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY_PATTERN.test(encodedKey)) {
    throw new Error("Copilot token encryption is not configured");
  }
  const raw = base64UrlToBytes(encodedKey);
  if (raw.byteLength !== 32) {
    throw new Error("Copilot token encryption key must be 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

export function copilotEncryptionConfigured(encodedKey?: string): boolean {
  return Boolean(encodedKey && ENCRYPTION_KEY_PATTERN.test(encodedKey));
}

export async function encryptCopilotToken(
  token: string,
  userId: string,
  expiresAt: string,
  encodedKey: string,
): Promise<EncryptedCopilotGrant> {
  if (!TOKEN_PATTERN.test(token) || !USER_ID_PATTERN.test(userId)) {
    throw new Error("invalid Copilot delegation");
  }
  const key = await importEncryptionKey(encodedKey, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: additionalData(userId, expiresAt),
    },
    key,
    new TextEncoder().encode(token),
  );
  return {
    version: 1,
    user_id: userId,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    expires_at: expiresAt,
  };
}

export async function decryptCopilotToken(
  grant: EncryptedCopilotGrant,
  encodedKey: string,
): Promise<string> {
  if (!isGrant(grant) || Date.parse(grant.expires_at) <= Date.now()) {
    throw new Error("Copilot delegation expired");
  }
  const key = await importEncryptionKey(encodedKey, "decrypt");
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(grant.iv),
      additionalData: additionalData(grant.user_id, grant.expires_at),
    },
    key,
    base64UrlToBytes(grant.ciphertext),
  );
  const token = new TextDecoder().decode(plaintext);
  if (!TOKEN_PATTERN.test(token)) throw new Error("invalid Copilot delegation");
  return token;
}

export class CopilotGrantGuard {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;

    if (path === "/put" && req.method === "POST") {
      let grant: unknown;
      try {
        grant = await req.json();
      } catch {
        return Response.json({ error: "invalid grant" }, { status: 400 });
      }
      if (!isGrant(grant) || Date.parse(grant.expires_at) <= Date.now()) {
        return Response.json({ error: "invalid grant" }, { status: 400 });
      }
      await this.state.storage.put(GRANT_KEY, grant);
      await this.state.storage.setAlarm(Date.parse(grant.expires_at));
      return Response.json({ ok: true, expires_at: grant.expires_at });
    }

    if (path === "/consume" && req.method === "POST") {
      const grant = await this.state.storage.transaction<EncryptedCopilotGrant | null>(
        async (transaction) => {
          const stored = await transaction.get<EncryptedCopilotGrant>(GRANT_KEY);
          if (stored) await transaction.delete(GRANT_KEY);
          return stored ?? null;
        },
      );
      if (!grant || !isGrant(grant) || Date.parse(grant.expires_at) <= Date.now()) {
        return Response.json({ error: "Copilot connection required" }, { status: 404 });
      }
      return Response.json(grant);
    }

    if (path === "/status" && req.method === "GET") {
      const grant = await this.state.storage.get<EncryptedCopilotGrant>(GRANT_KEY);
      const connected = Boolean(
        grant && isGrant(grant) && Date.parse(grant.expires_at) > Date.now(),
      );
      if (!connected && grant) await this.state.storage.delete(GRANT_KEY);
      return Response.json({
        connected,
        expires_at: connected ? grant?.expires_at : null,
      });
    }

    if (path === "/revoke" && req.method === "POST") {
      await this.state.storage.deleteAll();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

export async function storeCopilotGrant(
  env: CopilotGrantEnv,
  sessionToken: string,
  grant: EncryptedCopilotGrant,
): Promise<void> {
  const response = await grantNamespace(env, sessionToken).fetch(
    "https://copilot-grant.internal/put",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grant),
    },
  );
  if (!response.ok) throw new Error(`Copilot grant store failed: ${response.status}`);
}

export async function consumeCopilotGrant(
  env: CopilotGrantEnv,
  sessionToken: string,
): Promise<EncryptedCopilotGrant | null> {
  const response = await grantNamespace(env, sessionToken).fetch(
    "https://copilot-grant.internal/consume",
    { method: "POST" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Copilot grant consume failed: ${response.status}`);
  const grant = (await response.json()) as unknown;
  return isGrant(grant) ? grant : null;
}

export async function getCopilotGrantStatus(
  env: CopilotGrantEnv,
  sessionToken: string,
): Promise<{ connected: boolean; expires_at: string | null }> {
  const response = await grantNamespace(env, sessionToken).fetch(
    "https://copilot-grant.internal/status",
  );
  if (!response.ok) throw new Error(`Copilot grant status failed: ${response.status}`);
  return (await response.json()) as {
    connected: boolean;
    expires_at: string | null;
  };
}

export async function revokeCopilotGrant(
  env: CopilotGrantEnv,
  sessionToken: string,
): Promise<void> {
  const response = await grantNamespace(env, sessionToken).fetch(
    "https://copilot-grant.internal/revoke",
    { method: "POST" },
  );
  if (!response.ok) throw new Error(`Copilot grant revoke failed: ${response.status}`);
}
