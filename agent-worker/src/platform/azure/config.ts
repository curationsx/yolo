/**
 * Fail-fast Azure gateway configuration.
 *
 * All required environment variables are validated together at startup so a
 * broken revision reports every missing/invalid value at once and never
 * receives traffic (Container Apps only routes to ready revisions).
 *
 * Credential selection follows the deployment plan: local development uses
 * `DefaultAzureCredential`; production uses `ManagedIdentityCredential` with
 * an explicit `AZURE_CLIENT_ID`. Selection is a pure function of the
 * environment record so it can be unit tested without real Azure calls.
 */

import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import type { TokenCredential } from "@azure/identity";
import { GatewayErrors } from "./errors.ts";

export interface AzureGatewayConfig {
  port: number;
  allowedOrigins: string;
  githubClientId?: string;
  githubClientSecret?: string;
  githubRepositoryToken?: string;
  copilotTokenEncryptionKey?: string;
  copilotConnectionTtlSeconds?: string;
  azureClientId?: string;
  cosmosEndpoint: string;
  cosmosDatabase: string;
  cosmosGatewayStateContainer: string;
  cosmosContainer: string;
  cosmosVotesContainer: string;
  cosmosScoresContainer: string;
  cosmosDiscussionsContainer: string;
  foundryEndpoint: string;
  foundryDeployment: string;
  copilotRuntimeUrl: string;
  copilotRuntimeSharedSecret: string;
  copilotRuntimeTimeoutMs: number;
  maxQuestionChars: string;
  maxOutputTokens: string;
  perIpDailyLimit: string;
  globalDailyLimit: string;
  copilotModel: string;
  copilotMaxPromptChars: string;
  copilotMaxResponseChars: string;
  copilotMaxAiCredits: string;
  copilotRunsPerUserDaily: string;
  copilotRunsPerIpDaily: string;
  copilotRunsGlobalDaily: string;
  softwareTargets: string;
  voteBackend: "kv" | "durable";
}

type EnvRecord = Record<string, string | undefined>;

function required(env: EnvRecord, name: string, missing: string[]): string {
  const value = env[name];
  if (!value) missing.push(name);
  return value ?? "";
}

/** Parses and validates every required variable in one pass. Throws a single
 * `GatewayError` listing every missing name when any are absent. */
export function loadAzureConfig(env: EnvRecord): AzureGatewayConfig {
  const missing: string[] = [];

  const config: AzureGatewayConfig = {
    port: Number.parseInt(env.PORT ?? "8080", 10),
    allowedOrigins: required(env, "ALLOWED_ORIGINS", missing),
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    githubRepositoryToken: env.GITHUB_REPOSITORY_TOKEN,
    copilotTokenEncryptionKey: env.COPILOT_TOKEN_ENCRYPTION_KEY,
    copilotConnectionTtlSeconds: env.COPILOT_CONNECTION_TTL_SECONDS,
    azureClientId: env.AZURE_CLIENT_ID,
    cosmosEndpoint: required(env, "COSMOS_ENDPOINT", missing),
    cosmosDatabase: required(env, "COSMOS_DATABASE", missing),
    cosmosGatewayStateContainer: env.COSMOS_GATEWAY_STATE_CONTAINER || "gateway-state",
    cosmosContainer: required(env, "COSMOS_CONTAINER", missing),
    cosmosVotesContainer: required(env, "COSMOS_VOTES_CONTAINER", missing),
    cosmosScoresContainer: required(env, "COSMOS_SCORES_CONTAINER", missing),
    cosmosDiscussionsContainer: required(env, "COSMOS_DISCUSSIONS_CONTAINER", missing),
    foundryEndpoint: required(env, "AZURE_OPENAI_ENDPOINT", missing),
    foundryDeployment: required(env, "AZURE_OPENAI_DEPLOYMENT", missing),
    copilotRuntimeUrl: required(env, "COPILOT_RUNTIME_URL", missing),
    copilotRuntimeSharedSecret: required(env, "COPILOT_RUNTIME_SHARED_SECRET", missing),
    copilotRuntimeTimeoutMs: Number.parseInt(env.COPILOT_RUNTIME_TIMEOUT_MS ?? "150000", 10),
    maxQuestionChars: env.MAX_QUESTION_CHARS || "4000",
    maxOutputTokens: env.MAX_OUTPUT_TOKENS || "512",
    perIpDailyLimit: env.PER_IP_DAILY_LIMIT || "10",
    globalDailyLimit: env.GLOBAL_DAILY_LIMIT || "200",
    copilotModel: env.COPILOT_MODEL || "gpt-5.4",
    copilotMaxPromptChars: env.COPILOT_MAX_PROMPT_CHARS || "60000",
    copilotMaxResponseChars: env.COPILOT_MAX_RESPONSE_CHARS || "40000",
    copilotMaxAiCredits: env.COPILOT_MAX_AI_CREDITS || "10",
    copilotRunsPerUserDaily: env.COPILOT_RUNS_PER_USER_DAILY || "5",
    copilotRunsPerIpDaily: env.COPILOT_RUNS_PER_IP_DAILY || "10",
    copilotRunsGlobalDaily: env.COPILOT_RUNS_GLOBAL_DAILY || "100",
    softwareTargets: required(env, "SOFTWARE_TARGETS", missing),
    voteBackend: env.VOTE_BACKEND === "kv" ? "kv" : "durable",
  };

  if (!Number.isSafeInteger(config.port) || config.port < 0) {
    missing.push("PORT (invalid)");
  }
  if (!Number.isSafeInteger(config.copilotRuntimeTimeoutMs) || config.copilotRuntimeTimeoutMs <= 0) {
    missing.push("COPILOT_RUNTIME_TIMEOUT_MS (invalid)");
  }

  if (missing.length > 0) {
    throw GatewayErrors.configInvalid({ missing });
  }

  return config;
}

/** One lazy singleton credential per process, matching the plan's
 * performance rules. Production selects `ManagedIdentityCredential` with an
 * explicit client id; local development falls back to
 * `DefaultAzureCredential`. */
export function createAzureCredential(config: Pick<AzureGatewayConfig, "azureClientId">): TokenCredential {
  return config.azureClientId
    ? new ManagedIdentityCredential({ clientId: config.azureClientId })
    : new DefaultAzureCredential();
}

let cachedCredential: TokenCredential | undefined;

/** Returns the one-per-process credential singleton, creating it on first
 * use. Tests should call `loadAzureConfig`/`createAzureCredential` directly
 * instead of this memoized accessor. */
export function getSharedAzureCredential(config: Pick<AzureGatewayConfig, "azureClientId">): TokenCredential {
  if (!cachedCredential) cachedCredential = createAzureCredential(config);
  return cachedCredential;
}
