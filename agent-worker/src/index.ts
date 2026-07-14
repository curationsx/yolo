/**
 * CURATIONS gateway router — Cloudflare Worker entrypoint.
 *
 * This is the only file (besides `platform/cloudflare.ts`) that references
 * Cloudflare's `KVNamespace`, `DurableObjectNamespace`, or Container types.
 * It builds one project-owned `Env` (see `./env.ts`) from the real bindings
 * and hands off to the shared Fetch router in `./router.ts`, which the
 * Node/Azure entrypoint (`platform/azure/server.ts`) also calls.
 */

import { copilotAuthConfigured, githubAuthConfigured } from "./auth.ts";
import type { CopilotRuntime } from "./copilot-runtime.ts";
import type { Env } from "./env.ts";
import {
  createCloudflareAgentModelClient,
  createCloudflareCommunityStore,
  createCloudflareCopilotGrantStore,
  createCloudflareCopilotRuntimeClient,
  createCloudflareQuotaStore,
  createCloudflareReadinessProbe,
  createCloudflareRequestMetadata,
  createCloudflareVoteStore,
} from "./platform/cloudflare.ts";
import { handleRequest } from "./router.ts";

export { QuotaGuard } from "./quota.ts";
export { VoteGuard } from "./vote-guard.ts";
export { CopilotGrantGuard } from "./copilot-grant.ts";
export { CopilotRuntime } from "./copilot-runtime.ts";

/** The real Cloudflare binding surface configured in `wrangler.toml`. */
export interface CloudflareBindings {
  RATE: KVNamespace;
  QUOTA: DurableObjectNamespace;
  VOTE_GUARD: DurableObjectNamespace;
  COPILOT_GRANT: DurableObjectNamespace;
  COPILOT_RUNTIME: DurableObjectNamespace<CopilotRuntime>;
  ALLOWED_ORIGINS: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REPOSITORY_TOKEN?: string;
  COPILOT_TOKEN_ENCRYPTION_KEY?: string;
  COPILOT_CONNECTION_TTL_SECONDS?: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  COSMOS_KEY: string;
  COSMOS_ENDPOINT: string;
  COSMOS_DATABASE: string;
  COSMOS_CONTAINER: string;
  COSMOS_VOTES_CONTAINER: string;
  COSMOS_SCORES_CONTAINER: string;
  COSMOS_DISCUSSIONS_CONTAINER: string;
  MAX_QUESTION_CHARS: string;
  MAX_OUTPUT_TOKENS: string;
  PER_IP_DAILY_LIMIT: string;
  GLOBAL_DAILY_LIMIT: string;
  COPILOT_MODEL: string;
  COPILOT_MAX_PROMPT_CHARS: string;
  COPILOT_MAX_RESPONSE_CHARS: string;
  COPILOT_MAX_AI_CREDITS: string;
  COPILOT_RUNS_PER_USER_DAILY: string;
  COPILOT_RUNS_PER_IP_DAILY: string;
  COPILOT_RUNS_GLOBAL_DAILY: string;
  SOFTWARE_TARGETS: string;
  VOTE_BACKEND: "kv" | "durable";
}

function buildGatewayEnv(bindings: CloudflareBindings): Env {
  const env: Env = {
    ALLOWED_ORIGINS: bindings.ALLOWED_ORIGINS,
    GITHUB_CLIENT_ID: bindings.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: bindings.GITHUB_CLIENT_SECRET,
    GITHUB_REPOSITORY_TOKEN: bindings.GITHUB_REPOSITORY_TOKEN,
    COPILOT_TOKEN_ENCRYPTION_KEY: bindings.COPILOT_TOKEN_ENCRYPTION_KEY,
    COPILOT_CONNECTION_TTL_SECONDS: bindings.COPILOT_CONNECTION_TTL_SECONDS,
    RATE: bindings.RATE,
    quota: createCloudflareQuotaStore(bindings.QUOTA),
    copilotGrants: createCloudflareCopilotGrantStore(bindings.COPILOT_GRANT),
    votes: createCloudflareVoteStore({
      RATE: bindings.RATE,
      VOTE_GUARD: bindings.VOTE_GUARD,
      COSMOS_ENDPOINT: bindings.COSMOS_ENDPOINT,
      COSMOS_KEY: bindings.COSMOS_KEY,
      COSMOS_DATABASE: bindings.COSMOS_DATABASE,
      COSMOS_VOTES_CONTAINER: bindings.COSMOS_VOTES_CONTAINER,
      COSMOS_SCORES_CONTAINER: bindings.COSMOS_SCORES_CONTAINER,
    }),
    community: createCloudflareCommunityStore({
      endpoint: bindings.COSMOS_ENDPOINT,
      key: bindings.COSMOS_KEY,
      database: bindings.COSMOS_DATABASE,
    }),
    agentModel: createCloudflareAgentModelClient({
      endpoint: bindings.AZURE_OPENAI_ENDPOINT,
      apiKey: bindings.AZURE_OPENAI_API_KEY,
      deployment: bindings.AZURE_OPENAI_DEPLOYMENT,
    }),
    copilotRuntime: createCloudflareCopilotRuntimeClient(bindings.COPILOT_RUNTIME),
    requestMetadata: createCloudflareRequestMetadata(),
    // Placeholder; replaced below once the rest of `env` can be inspected.
    readiness: createCloudflareReadinessProbe({}),
    AZURE_OPENAI_DEPLOYMENT: bindings.AZURE_OPENAI_DEPLOYMENT,
    COSMOS_CONTAINER: bindings.COSMOS_CONTAINER,
    COSMOS_VOTES_CONTAINER: bindings.COSMOS_VOTES_CONTAINER,
    COSMOS_SCORES_CONTAINER: bindings.COSMOS_SCORES_CONTAINER,
    COSMOS_DISCUSSIONS_CONTAINER: bindings.COSMOS_DISCUSSIONS_CONTAINER,
    MAX_QUESTION_CHARS: bindings.MAX_QUESTION_CHARS,
    MAX_OUTPUT_TOKENS: bindings.MAX_OUTPUT_TOKENS,
    PER_IP_DAILY_LIMIT: bindings.PER_IP_DAILY_LIMIT,
    GLOBAL_DAILY_LIMIT: bindings.GLOBAL_DAILY_LIMIT,
    COPILOT_MODEL: bindings.COPILOT_MODEL,
    COPILOT_MAX_PROMPT_CHARS: bindings.COPILOT_MAX_PROMPT_CHARS,
    COPILOT_MAX_RESPONSE_CHARS: bindings.COPILOT_MAX_RESPONSE_CHARS,
    COPILOT_MAX_AI_CREDITS: bindings.COPILOT_MAX_AI_CREDITS,
    COPILOT_RUNS_PER_USER_DAILY: bindings.COPILOT_RUNS_PER_USER_DAILY,
    COPILOT_RUNS_PER_IP_DAILY: bindings.COPILOT_RUNS_PER_IP_DAILY,
    COPILOT_RUNS_GLOBAL_DAILY: bindings.COPILOT_RUNS_GLOBAL_DAILY,
    SOFTWARE_TARGETS: bindings.SOFTWARE_TARGETS,
    VOTE_BACKEND: bindings.VOTE_BACKEND,
  };
  // Cloudflare readiness is a bounded, non-billable configuration check — no
  // network dependency call is made, matching the existing Worker dry-run
  // compatibility contract.
  env.readiness = createCloudflareReadinessProbe({
    github: githubAuthConfigured(env),
    copilot: copilotAuthConfigured(env),
    cosmos: Boolean(bindings.COSMOS_ENDPOINT && bindings.COSMOS_KEY),
    foundry: Boolean(bindings.AZURE_OPENAI_ENDPOINT && bindings.AZURE_OPENAI_API_KEY),
  });
  return env;
}

export default {
  async fetch(req: Request, bindings: CloudflareBindings): Promise<Response> {
    return handleRequest(req, buildGatewayEnv(bindings));
  },
} satisfies ExportedHandler<CloudflareBindings>;
