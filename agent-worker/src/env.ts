import type { AuthEnv } from "./auth";
import type { CopilotRuntime } from "./copilot-runtime";

export interface Env extends AuthEnv {
  QUOTA: DurableObjectNamespace;
  VOTE_GUARD: DurableObjectNamespace;
  COPILOT_GRANT: DurableObjectNamespace;
  COPILOT_RUNTIME: DurableObjectNamespace<CopilotRuntime>;
  AZURE_OPENAI_API_KEY: string;
  COSMOS_KEY: string;
  GITHUB_REPOSITORY_TOKEN?: string;
  COPILOT_TOKEN_ENCRYPTION_KEY?: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT: string;
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
  COPILOT_CONNECTION_TTL_SECONDS: string;
  COPILOT_RUNS_PER_USER_DAILY: string;
  COPILOT_RUNS_PER_IP_DAILY: string;
  COPILOT_RUNS_GLOBAL_DAILY: string;
  SOFTWARE_TARGETS: string;
  VOTE_BACKEND: "kv" | "durable";
}

export interface Persona {
  id: string;
  display_name: string;
  tool_id: string;
  disclosure: string;
  system_prompt: string;
}
