/**
 * Node/Azure gateway entrypoint.
 *
 * Boots with fail-fast configuration, builds one lazy singleton
 * `DefaultAzureCredential`/`ManagedIdentityCredential` and one lazy
 * singleton `CosmosClient`, wires every Azure adapter into the same
 * project-owned `Env` the Cloudflare Worker uses, and serves the shared
 * Fetch router (`../../router.ts`) over native Node HTTP. A broken
 * configuration throws before the server starts listening, so Container
 * Apps never routes traffic to an unready revision.
 */

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import type { Env } from "../../env.ts";
import { handleRequest } from "../../router.ts";
import { copilotAuthConfigured, githubAuthConfigured } from "../../auth.ts";
import { createAzureAgentModelClient } from "./foundry.ts";
import { createAzureCommunityStore, createAzureVoteStore } from "./community.ts";
import { createAzureCopilotRuntimeClient } from "./runtime.ts";
import {
  createAzureCopilotGrantStore,
  createAzureKeyValueStore,
  createAzureProjectPreviewStore,
  createAzureQuotaStore,
} from "./state.ts";
import { createAzureReadinessProbe } from "./readiness.ts";
import { getSharedAzureCredential, loadAzureConfig, type AzureGatewayConfig } from "./config.ts";
import { nodeRequestToFetchRequest, RequestBodyTooLargeError, requestTooLargeResponse, sendFetchResponse } from "./http-adapter.ts";
import { logError, logRequest } from "./logging.ts";
import { isGatewayError } from "./errors.ts";
import type { CosmosContainerLike } from "./cosmos-types.ts";

/** `credential` is injected (rather than constructed here) so tests can
 * supply a fake `TokenCredential` and so production wires exactly one
 * lazy-singleton credential per process (`getSharedAzureCredential`). */
export function buildAzureEnv(
  config: AzureGatewayConfig,
  cosmosClient: CosmosClient,
  credential: TokenCredential,
): Env {
  const database = cosmosClient.database(config.cosmosDatabase);
  const containerCache = new Map<string, CosmosContainerLike>();
  const containerFor = (name: string): CosmosContainerLike => {
    let container = containerCache.get(name);
    if (!container) {
      container = database.container(name);
      containerCache.set(name, container);
    }
    return container;
  };

  const gatewayStateContainer = containerFor(config.cosmosGatewayStateContainer);
  const votesContainer = containerFor(config.cosmosVotesContainer);
  const gatewayState = createAzureKeyValueStore(gatewayStateContainer);

  const env: Env = {
    ALLOWED_ORIGINS: config.allowedOrigins,
    GITHUB_CLIENT_ID: config.githubClientId,
    GITHUB_CLIENT_SECRET: config.githubClientSecret,
    GITHUB_REPOSITORY_TOKEN: config.githubRepositoryToken,
    COPILOT_TOKEN_ENCRYPTION_KEY: config.copilotTokenEncryptionKey,
    COPILOT_CONNECTION_TTL_SECONDS: config.copilotConnectionTtlSeconds,
    RATE: gatewayState,
    quota: createAzureQuotaStore(gatewayStateContainer),
    projectPreviews: createAzureProjectPreviewStore(gatewayStateContainer),
    copilotGrants: createAzureCopilotGrantStore(gatewayStateContainer),
    votes: createAzureVoteStore(votesContainer),
    community: createAzureCommunityStore(containerFor),
    agentModel: createAzureAgentModelClient(
      { endpoint: config.foundryEndpoint, deployment: config.foundryDeployment },
      credential,
    ),
    copilotRuntime: createAzureCopilotRuntimeClient({
      url: config.copilotRuntimeUrl,
      sharedSecret: config.copilotRuntimeSharedSecret,
    }),
    requestMetadata: {
      // Azure Container Apps appends the platform-observed address as the
      // rightmost X-Forwarded-For entry; anything a client supplies before
      // it is untrusted.
      clientIp: (req: Request) => {
        const header = req.headers.get("x-forwarded-for");
        if (!header) return "unknown";
        const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : "unknown";
      },
    },
    readiness: createAzureReadinessProbe({
      gatewayStateContainer,
      credential,
      configured: {
        github: false, // replaced below once env exists
      },
    }),
    AZURE_OPENAI_DEPLOYMENT: config.foundryDeployment,
    COSMOS_CONTAINER: config.cosmosContainer,
    COSMOS_VOTES_CONTAINER: config.cosmosVotesContainer,
    COSMOS_SCORES_CONTAINER: config.cosmosScoresContainer,
    COSMOS_DISCUSSIONS_CONTAINER: config.cosmosDiscussionsContainer,
    MAX_QUESTION_CHARS: config.maxQuestionChars,
    MAX_OUTPUT_TOKENS: config.maxOutputTokens,
    PER_IP_DAILY_LIMIT: config.perIpDailyLimit,
    GLOBAL_DAILY_LIMIT: config.globalDailyLimit,
    COPILOT_MODEL: config.copilotModel,
    COPILOT_MAX_PROMPT_CHARS: config.copilotMaxPromptChars,
    COPILOT_MAX_RESPONSE_CHARS: config.copilotMaxResponseChars,
    COPILOT_MAX_AI_CREDITS: config.copilotMaxAiCredits,
    COPILOT_RUNS_PER_USER_DAILY: config.copilotRunsPerUserDaily,
    COPILOT_RUNS_PER_IP_DAILY: config.copilotRunsPerIpDaily,
    COPILOT_RUNS_GLOBAL_DAILY: config.copilotRunsGlobalDaily,
    SOFTWARE_TARGETS: config.softwareTargets,
    VOTE_BACKEND: config.voteBackend,
  };

  env.readiness = createAzureReadinessProbe({
    gatewayStateContainer,
    credential,
    configured: {
      github: githubAuthConfigured(env),
      copilot: copilotAuthConfigured(env),
    },
  });

  return env;
}

export interface AzureGatewayServer {
  /** Resolves once the server is actually listening — needed because `PORT=0`
   * assigns an ephemeral port asynchronously. */
  ready: Promise<void>;
  address(): { port: number } | null;
  close(): Promise<void>;
}

/** One incoming request's full lifecycle: Node request -> Fetch request ->
 * shared router -> Fetch response -> Node response, with redacted
 * structured logging and a last-resort 500 fallback. Exported (not just an
 * inline `createServer` closure) so tests can drive it directly with a
 * synthetic request/response pair — including edge cases a real Node HTTP
 * client can never produce, like a request object with no URL. */
export function handleIncomingHttpRequest(req: IncomingMessage, res: ServerResponse, env: Env): void {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  void (async () => {
    let request: Request;
    try {
      request = await nodeRequestToFetchRequest(req);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        await sendFetchResponse(requestTooLargeResponse(), res);
        logRequest({ route: req.url ?? "/", method: req.method ?? "GET", status: 413, latencyMs: Date.now() - startedAt, correlationId });
        return;
      }
      throw error;
    }
    request.headers.set("x-correlation-id", correlationId);

    try {
      const response = await handleRequest(request, env);
      await sendFetchResponse(response, res);
      logRequest({
        route: new URL(request.url).pathname,
        method: request.method,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        correlationId,
      });
    } catch (error) {
      const response = isGatewayError(error)
        ? error.toResponse()
        : new Response(JSON.stringify({ error: "internal error", code: "internal_error" }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
      await sendFetchResponse(response, res);
      logError(new URL(request.url).pathname, correlationId, error);
    }
  })().catch((error) => {
    logError(req.url ?? "/", correlationId, error);
    // A response may already have been fully sent (e.g. a logging call
    // that runs after a successful write throws) — writing headers or
    // ending the stream again would crash the process, so both are
    // guarded by whether the response is still open.
    if (res.writableEnded) return;
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: "internal error", code: "internal_error" }));
  });
}

export function startAzureGateway(
  config: AzureGatewayConfig = loadAzureConfig(process.env),
  cosmosClient: CosmosClient = new CosmosClient({
    endpoint: config.cosmosEndpoint,
    aadCredentials: getSharedAzureCredential(config),
  }),
  credential: TokenCredential = getSharedAzureCredential(config),
): AzureGatewayServer {
  const env = buildAzureEnv(config, cosmosClient, credential);

  const server = createServer((req, res) => handleIncomingHttpRequest(req, res, env));

  server.listen(config.port, "0.0.0.0");
  const ready = new Promise<void>((resolve) => server.once("listening", () => resolve()));

  return {
    ready,
    address: () => {
      const info = server.address();
      return info && typeof info === "object" ? { port: info.port } : null;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startAzureGateway();
  process.once("SIGTERM", () => process.exit(0));
  process.once("SIGINT", () => process.exit(0));
}
