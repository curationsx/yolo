import type { AuthEnv } from "./auth";

export interface Env extends AuthEnv {
  QUOTA: DurableObjectNamespace;
  VOTE_GUARD: DurableObjectNamespace;
  AZURE_OPENAI_API_KEY: string;
  COSMOS_KEY: string;
  GITHUB_REPOSITORY_TOKEN?: string;
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
