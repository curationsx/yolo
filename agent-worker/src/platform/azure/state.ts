/**
 * Azure Cosmos `gateway-state` repository.
 *
 * Partition key: `/scope`. Every document ID is a SHA-256 hash of the
 * secret-bearing key (session token, OAuth state, ticket, or grant key) —
 * raw tokens are never stored as document IDs or logged. TTL is set per
 * record via Cosmos's native `ttl` field. Quota reservation and release use
 * one document per UTC day updated with bounded, jittered ETag
 * compare-and-swap retries so a rejected request can never partially consume
 * another rule's allowance. Copilot grant consumption is a single
 * conditional delete — the SDK never needs a read-then-write race window
 * because the delete itself is the atomic operation.
 */

import { createHash } from "node:crypto";
import type {
  CopilotGrantStatus,
  CopilotGrantStore,
  EncryptedCopilotGrant,
  KeyValueStore,
  QuotaResult,
  QuotaRule,
  QuotaStore,
} from "../contracts.ts";
import type { CosmosContainerLike, CosmosResource } from "./cosmos-types.ts";
import { GatewayErrors } from "./errors.ts";

const KV_SCOPE = "kv";
const GRANT_SCOPE = "copilot-grant";
const QUOTA_SCOPE = "quota";
const MAX_CAS_ATTEMPTS = 8;
const QUOTA_TTL_SECONDS = 2 * 24 * 60 * 60;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cosmosStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") return code;
    if (typeof code === "string" && /^\d+$/.test(code)) return Number(code);
  }
  return undefined;
}

function retryAfterMs(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "retryAfterInMs" in error) {
    const value = (error as { retryAfterInMs?: unknown }).retryAfterInMs;
    if (typeof value === "number") return value;
  }
  return undefined;
}

async function jitteredBackoff(attempt: number, baseMs = 8): Promise<void> {
  const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

interface KvDoc extends CosmosResource {
  scope: typeof KV_SCOPE;
  value: string;
}

/** Generic KV store backing `env.RATE` on Azure — sessions, OAuth state,
 * Copilot connect tickets, and the legacy vote mirror all funnel through
 * this one narrow contract, exactly like Cloudflare's KV binding. */
export function createAzureKeyValueStore(container: CosmosContainerLike): KeyValueStore {
  return {
    async get<T = string>(key: string, type?: "json"): Promise<T | null> {
      const id = sha256Hex(`${KV_SCOPE}:${key}`);
      const response = await container.item(id, KV_SCOPE).read();
      if (response.statusCode === 404 || !response.resource) return null;
      const raw = (response.resource as KvDoc).value;
      return type === "json" ? (JSON.parse(raw) as T) : (raw as unknown as T);
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const id = sha256Hex(`${KV_SCOPE}:${key}`);
      const doc: KvDoc = { id, scope: KV_SCOPE, value };
      if (options?.expirationTtl) doc.ttl = options.expirationTtl;
      await container.items.upsert(doc);
    },
    async delete(key: string): Promise<void> {
      const id = sha256Hex(`${KV_SCOPE}:${key}`);
      try {
        await container.item(id, KV_SCOPE).delete();
      } catch (error) {
        if (cosmosStatus(error) !== 404) throw error;
      }
    },
  };
}

interface GrantDoc extends CosmosResource {
  scope: typeof GRANT_SCOPE;
  grant: EncryptedCopilotGrant;
}

function grantExpired(grant: EncryptedCopilotGrant): boolean {
  return Date.parse(grant.expires_at) <= Date.now();
}

/** One-use encrypted Copilot grant with ETag-conditional consume. A second
 * consumer always loses the race and receives `null` — there is no
 * automatic replay. */
export function createAzureCopilotGrantStore(container: CosmosContainerLike): CopilotGrantStore {
  const item = (sessionToken: string) => container.item(sha256Hex(`${GRANT_SCOPE}:${sessionToken}`), GRANT_SCOPE);

  return {
    async put(sessionToken: string, grant: EncryptedCopilotGrant): Promise<void> {
      const ttl = Math.max(1, Math.ceil((Date.parse(grant.expires_at) - Date.now()) / 1000));
      const doc: GrantDoc = {
        id: sha256Hex(`${GRANT_SCOPE}:${sessionToken}`),
        scope: GRANT_SCOPE,
        grant,
        ttl,
      };
      await container.items.upsert(doc);
    },

    async consume(sessionToken: string): Promise<EncryptedCopilotGrant | null> {
      const stub = item(sessionToken);
      const read = await stub.read();
      if (read.statusCode === 404 || !read.resource) return null;
      const grantDoc = read.resource as GrantDoc;
      if (grantExpired(grantDoc.grant)) {
        try {
          await stub.delete({ accessCondition: { type: "IfMatch", condition: read.etag } });
        } catch {
          // best-effort cleanup of an expired grant; consume still returns null
        }
        return null;
      }
      try {
        await stub.delete({ accessCondition: { type: "IfMatch", condition: read.etag } });
      } catch (error) {
        // Another consumer (or a revoke) won the race — at-most-once holds.
        if (cosmosStatus(error) === 412 || cosmosStatus(error) === 404) return null;
        throw error;
      }
      return grantDoc.grant;
    },

    async status(sessionToken: string): Promise<CopilotGrantStatus> {
      const read = await item(sessionToken).read();
      if (read.statusCode === 404 || !read.resource) return { connected: false, expires_at: null };
      const grantDoc = read.resource as GrantDoc;
      if (grantExpired(grantDoc.grant)) return { connected: false, expires_at: null };
      return { connected: true, expires_at: grantDoc.grant.expires_at };
    },

    async revoke(sessionToken: string): Promise<void> {
      try {
        await item(sessionToken).delete();
      } catch (error) {
        if (cosmosStatus(error) !== 404) throw error;
      }
    },
  };
}

interface QuotaDoc extends CosmosResource {
  scope: typeof QUOTA_SCOPE;
  counters: Record<string, number>;
}

function quotaDocId(date: string): string {
  return sha256Hex(`${QUOTA_SCOPE}:${date}`);
}

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function evaluateRules(
  counters: Record<string, number>,
  rules: QuotaRule[],
): { allowed: true } | { allowed: false; blocked_key: string } {
  for (const rule of rules) {
    if ((counters[rule.key] ?? 0) >= rule.limit) {
      return { allowed: false, blocked_key: rule.key };
    }
  }
  return { allowed: true };
}

/** One document per UTC day holding every user/IP/global counter. A single
 * ETag compare-and-swap checks and increments (or decrements, on release)
 * every rule together, so a rejected request can never partially consume
 * another rule's allowance. Bounded, jittered retries handle concurrent
 * writers and 429 throttling; exhausting retries returns a typed
 * dependency error rather than looping forever. */
export function createAzureQuotaStore(container: CosmosContainerLike): QuotaStore {
  async function mutate(rules: QuotaRule[], mode: "reserve" | "release"): Promise<QuotaResult> {
    const id = quotaDocId(utcDateKey());
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      let existing: QuotaDoc | undefined;
      let etag: string | undefined;
      try {
        const read = await container.item(id, QUOTA_SCOPE).read();
        if (read.statusCode !== 404 && read.resource) {
          existing = read.resource as QuotaDoc;
          etag = read.etag;
        }
      } catch (error) {
        if (cosmosStatus(error) === 429) {
          await jitteredBackoff(attempt, retryAfterMs(error) ?? 8);
          continue;
        }
        throw error;
      }

      const counters = { ...(existing?.counters ?? {}) };
      if (mode === "reserve") {
        const evaluation = evaluateRules(counters, rules);
        if (!evaluation.allowed) return evaluation;
        for (const rule of rules) counters[rule.key] = (counters[rule.key] ?? 0) + 1;
      } else {
        for (const rule of rules) counters[rule.key] = Math.max(0, (counters[rule.key] ?? 0) - 1);
      }

      const doc: QuotaDoc = { id, scope: QUOTA_SCOPE, counters, ttl: QUOTA_TTL_SECONDS };
      try {
        if (existing) {
          await container
            .item(id, QUOTA_SCOPE)
            .replace(doc, { accessCondition: { type: "IfMatch", condition: etag! } });
        } else {
          await container.items.create(doc);
        }
        return { allowed: true };
      } catch (error) {
        const status = cosmosStatus(error);
        if (status === 412 || status === 409) {
          continue; // another writer raced us — re-read and retry
        }
        if (status === 429) {
          await jitteredBackoff(attempt, retryAfterMs(error) ?? 8);
          continue;
        }
        throw error;
      }
    }
    throw GatewayErrors.dependencyThrottled(1, { store: "quota" });
  }

  return {
    reserve: (rules) => mutate(rules, "reserve"),
    release: (rules) => mutate(rules, "release").then(() => undefined),
  };
}
