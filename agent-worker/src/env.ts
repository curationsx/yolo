import type { AuthEnv } from "./auth.ts";
import type {
  AgentModelClient,
  CommunityStore,
  CopilotGrantStore,
  CopilotRuntimeClient,
  QuotaStore,
  ProjectPreviewStore,
  ReadinessProbe,
  RequestMetadata,
  VoteStore,
} from "./platform/contracts.ts";

/**
 * Shared gateway environment. Route handlers (auth.ts, copilot.ts,
 * community.ts, router.ts) depend only on this project-owned shape — never on
 * `KVNamespace`, `DurableObjectNamespace`, `Fetcher`, or an Azure SDK type.
 * `index.ts` (Cloudflare) and `platform/azure/server.ts` (Node/Azure) each
 * construct one `Env` from their own bindings/clients.
 */
export interface Env extends AuthEnv {
  quota: QuotaStore;
  projectPreviews: ProjectPreviewStore;
  copilotGrants: CopilotGrantStore;
  votes: VoteStore;
  community: CommunityStore;
  agentModel: AgentModelClient;
  copilotRuntime: CopilotRuntimeClient;
  requestMetadata: RequestMetadata;
  readiness: ReadinessProbe;

  GITHUB_REPOSITORY_TOKEN?: string;
  /** Foundry deployment/model name, used only as a display label — the
   * network call itself goes through `agentModel`. */
  AZURE_OPENAI_DEPLOYMENT: string;
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
  PROJECT_MAINTAINER_GITHUB_IDS: string;
  VOTE_BACKEND: "kv" | "durable";
}

export interface Persona {
  id: string;
  display_name: string;
  tool_id: string;
  disclosure: string;
  system_prompt: string;
}
