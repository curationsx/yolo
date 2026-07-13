/**
 * Project-owned platform contracts.
 *
 * Shared route code (auth.ts, copilot.ts, community.ts, router.ts) depends
 * only on these narrow interfaces. It must never import Cloudflare's
 * `KVNamespace`, `DurableObjectNamespace`, or `Fetcher` types, and it must
 * never import an Azure SDK type either. Two adapter layers satisfy these
 * contracts:
 *
 * - `platform/cloudflare.ts` wraps KV, Durable Objects, and the Cloudflare
 *   Container runtime.
 * - `platform/azure/*` wraps the Cosmos SDK, Managed Identity, and an
 *   internal HTTPS call to the Copilot runtime Container App.
 */

/** Narrow key/value contract. Cloudflare's KVNamespace already satisfies this
 * shape structurally; the Azure adapter implements it against Cosmos. */
export interface KeyValueStore {
  get<T = string>(key: string, type?: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface QuotaRule {
  key: string;
  limit: number;
}

export interface QuotaResult {
  allowed: boolean;
  blocked_key?: string;
}

export interface QuotaStore {
  reserve(rules: QuotaRule[]): Promise<QuotaResult>;
  release(rules: QuotaRule[]): Promise<void>;
}

export interface EncryptedCopilotGrant {
  version: 1;
  user_id: string;
  iv: string;
  ciphertext: string;
  expires_at: string;
}

export interface CopilotGrantStatus {
  connected: boolean;
  expires_at: string | null;
}

/** One-use, at-most-once encrypted GitHub Copilot delegation. */
export interface CopilotGrantStore {
  put(sessionToken: string, grant: EncryptedCopilotGrant): Promise<void>;
  consume(sessionToken: string): Promise<EncryptedCopilotGrant | null>;
  status(sessionToken: string): Promise<CopilotGrantStatus>;
  revoke(sessionToken: string): Promise<void>;
}

export interface VoteMutationResult {
  target_id: string;
  voted: boolean;
  count: number;
}

/** Vote/score source of truth. Cloudflare serializes through a Durable
 * Object; Azure uses a same-partition Cosmos transactional batch.
 *
 * `getCounts` is the authoritative read path for public vote summaries —
 * on Cloudflare it reads the same legacy `scores` container the durable
 * Worker path already keeps current; on Azure it reads the same-partition
 * score metadata document `setVote` itself writes, so summaries never go
 * stale relative to the transactional batch that produced them. */
export interface VoteStore {
  setVote(targetId: string, userId: string, voted: boolean): Promise<VoteMutationResult>;
  getViewerVotes(userId: string, targets: string[]): Promise<string[]>;
  getCounts(targetIds: string[]): Promise<Record<string, number>>;
}

export type CosmosParameterValue = string | number | boolean | null | string[] | number[];

export interface CosmosQueryParameter {
  name: string;
  value: CosmosParameterValue;
}

/** Generic document store for the community/discussions containers. Both
 * adapters keep the same container names and document shapes; only the
 * transport (master-key REST vs. managed-identity SDK) changes. */
export interface CommunityStore {
  createDocument<T extends object>(container: string, doc: T, partitionKey: string): Promise<void>;
  readDocument<T>(container: string, id: string, partitionKey: string): Promise<T | null>;
  upsertDocument<T extends object>(container: string, doc: T, partitionKey: string): Promise<void>;
  deleteDocument(container: string, id: string, partitionKey: string): Promise<void>;
  queryDocuments<T>(
    container: string,
    query: string,
    parameters: CosmosQueryParameter[],
    partitionKey: string,
  ): Promise<T[]>;
}

export interface ChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

/** CURATIONS-funded Foundry persona calls. */
export interface AgentModelClient {
  chat(systemPrompt: string, userMessage: string, maxOutputTokens: number): Promise<ChatResult>;
}

export interface CopilotRunPayload {
  gitHubToken: string;
  prompt: string;
  runId: string;
  model: string;
  maxAiCredits: number;
}

export interface CopilotRunResult {
  status: number;
  ok: boolean;
  body: { content?: string; model?: string; error?: string; code?: string } | null;
}

/** User-funded Copilot runtime transport (gateway -> internal runtime). */
export interface CopilotRuntimeClient {
  run(payload: CopilotRunPayload, timeoutMs: number): Promise<CopilotRunResult>;
}

/** Client IP resolution. Cloudflare trusts `cf-connecting-ip`; Azure trusts
 * only the rightmost `X-Forwarded-For` entry supplied by Container Apps. */
export interface RequestMetadata {
  clientIp(req: Request): string;
}

export interface ReadinessCheckResult {
  ready: boolean;
  checks: Record<string, "ok" | "error">;
}

/** Bounded, non-billable dependency check for `/api/ready`. */
export interface ReadinessProbe {
  check(): Promise<ReadinessCheckResult>;
}
