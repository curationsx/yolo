/**
 * Cloudflare adapters. This is the only file (besides `env.ts`'s Cloudflare
 * binding surface in `index.ts`) allowed to reference `KVNamespace`,
 * `DurableObjectNamespace`, or `@cloudflare/containers` types directly. Every
 * adapter here returns a project-owned contract from `./contracts`.
 */

import { chat as chatWithApiKey, type AzureConfig } from "../azure.ts";
import type { CopilotRuntime } from "../copilot-runtime.ts";
import {
  consumeCopilotGrant,
  getCopilotGrantStatus,
  revokeCopilotGrant,
  storeCopilotGrant,
} from "../copilot-grant.ts";
import {
  createDocument,
  deleteDocument,
  queryDocuments,
  queryDocumentsCrossPartition,
  readDocument,
  replaceDocument,
  upsertDocument,
  type CosmosConfig,
} from "../cosmos.ts";
import { releaseDailyQuota, reserveDailyQuota } from "../quota.ts";
import { createCloudflareProjectPreviewStore as projectPreviewStore } from "../project-preview.ts";
import { getViewerVotes, setVote, type VoteGuardEnv } from "../vote-guard.ts";
import type {
  AgentModelClient,
  CommunityStore,
  CopilotGrantStore,
  CopilotRunPayload,
  CopilotRunResult,
  CopilotRuntimeClient,
  QuotaStore,
  ProjectPreviewStore,
  ReadinessProbe,
  RequestMetadata,
  VoteStore,
} from "./contracts.ts";

export function createCloudflareQuotaStore(namespace: DurableObjectNamespace): QuotaStore {
  const env = { QUOTA: namespace };
  return {
    reserve: (rules) => reserveDailyQuota(env, rules),
    release: (rules) => releaseDailyQuota(env, rules),
  };
}

export function createCloudflareProjectPreviewStore(
  namespace: DurableObjectNamespace,
): ProjectPreviewStore {
  return projectPreviewStore(namespace);
}

export function createCloudflareCopilotGrantStore(
  namespace: DurableObjectNamespace,
): CopilotGrantStore {
  const env = { COPILOT_GRANT: namespace };
  return {
    put: (sessionToken, grant) => storeCopilotGrant(env, sessionToken, grant),
    consume: (sessionToken) => consumeCopilotGrant(env, sessionToken),
    status: (sessionToken) => getCopilotGrantStatus(env, sessionToken),
    revoke: (sessionToken) => revokeCopilotGrant(env, sessionToken),
  };
}

export function createCloudflareVoteStore(deps: VoteGuardEnv): VoteStore {
  const scoresConfig: CosmosConfig = {
    endpoint: deps.COSMOS_ENDPOINT,
    key: deps.COSMOS_KEY,
    database: deps.COSMOS_DATABASE,
    container: deps.COSMOS_SCORES_CONTAINER,
  };
  return {
    setVote: (targetId, userId, voted) => setVote(deps, targetId, userId, voted),
    getViewerVotes: (userId, targets) => getViewerVotes(deps, userId, targets),
    async getCounts(targetIds: string[]): Promise<Record<string, number>> {
      // Preserves the exact legacy read path: the durable Cloudflare
      // VoteGuard already keeps this `scores` container current on every
      // vote (see vote-guard.ts's mutate()), so reading it here is not a
      // behavior change for Cloudflare.
      const counts: Record<string, number> = {};
      for (let offset = 0; offset < targetIds.length; offset += 100) {
        const chunk = targetIds.slice(offset, offset + 100);
        const parameters = chunk.map((target, index) => ({ name: `@target${index}`, value: target }));
        const placeholders = parameters.map((parameter) => parameter.name).join(", ");
        const rows = await queryDocuments<{ target_id: string; count: number }>(
          scoresConfig,
          `SELECT c.target_id, c.count FROM c WHERE c.target_id IN (${placeholders})`,
          parameters,
          "global",
        );
        for (const row of rows) counts[row.target_id] = row.count;
      }
      return counts;
    },
  };
}

export function createCloudflareCommunityStore(config: {
  endpoint: string;
  key: string;
  database: string;
}): CommunityStore {
  const cfg = (container: string): CosmosConfig => ({ ...config, container });
  return {
    createDocument: (container, doc, partitionKey) =>
      createDocument(cfg(container), doc, partitionKey),
    readDocument: (container, id, partitionKey) => readDocument(cfg(container), id, partitionKey),
    upsertDocument: (container, doc, partitionKey) =>
      upsertDocument(cfg(container), doc, partitionKey),
    replaceDocument: (container, id, doc, partitionKey, etag) =>
      replaceDocument(cfg(container), id, doc, partitionKey, etag),
    deleteDocument: (container, id, partitionKey) =>
      deleteDocument(cfg(container), id, partitionKey),
    queryDocuments: (container, query, parameters, partitionKey) =>
      queryDocuments(cfg(container), query, parameters, partitionKey),
    queryDocumentsCrossPartition: (container, query, parameters) =>
      queryDocumentsCrossPartition(cfg(container), query, parameters),
  };
}

export function createCloudflareAgentModelClient(config: {
  endpoint: string;
  apiKey: string;
  deployment: string;
}): AgentModelClient {
  return {
    chat: (systemPrompt, userMessage, maxOutputTokens) => {
      const azureConfig: AzureConfig = { ...config, maxOutputTokens };
      return chatWithApiKey(azureConfig, systemPrompt, userMessage);
    },
  };
}

export function createCloudflareCopilotRuntimeClient(
  namespace: DurableObjectNamespace<CopilotRuntime>,
): CopilotRuntimeClient {
  return {
    async run(payload: CopilotRunPayload, timeoutMs: number): Promise<CopilotRunResult> {
      const id = namespace.idFromName("shared-v1");
      const stub = namespace.get(id);
      const response = await stub.fetch(
        new Request("http://copilot-runtime/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      let body: CopilotRunResult["body"] = null;
      try {
        body = (await response.json()) as CopilotRunResult["body"];
      } catch {
        body = null;
      }
      return { status: response.status, ok: response.ok, body };
    },
  };
}

export function createCloudflareRequestMetadata(): RequestMetadata {
  return {
    clientIp: (req: Request) => req.headers.get("cf-connecting-ip") ?? "unknown",
  };
}

/** Cloudflare readiness is a bounded, non-billable configuration check — no
 * network dependency call is made, matching the existing Worker dry-run
 * compatibility contract. */
export function createCloudflareReadinessProbe(configured: Record<string, boolean>): ReadinessProbe {
  return {
    async check() {
      const checks: Record<string, "ok" | "error"> = {};
      let ready = true;
      for (const [name, value] of Object.entries(configured)) {
        checks[name] = value ? "ok" : "error";
        if (!value) ready = false;
      }
      return { ready, checks };
    },
  };
}
