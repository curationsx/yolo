/**
 * CURATIONS-funded Foundry persona calls on Azure — managed-identity bearer
 * tokens only, never an API key. Reuses the same `gpt-5.4-mini` restriction
 * and request/response shape as the Cloudflare path (`../../azure.ts`).
 */

import type { TokenCredential } from "@azure/identity";
import { chatWithBearerToken } from "../../azure.ts";
import type { AgentModelClient, ChatResult } from "../contracts.ts";

const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";

export interface AzureFoundryConfig {
  endpoint: string;
  deployment: string;
}

export function createAzureAgentModelClient(
  config: AzureFoundryConfig,
  credential: TokenCredential,
): AgentModelClient {
  return {
    async chat(systemPrompt: string, userMessage: string, maxOutputTokens: number): Promise<ChatResult> {
      const token = await credential.getToken(COGNITIVE_SERVICES_SCOPE);
      if (!token) {
        throw new Error("managed identity did not return a Foundry access token");
      }
      return chatWithBearerToken(
        { endpoint: config.endpoint, deployment: config.deployment, maxOutputTokens },
        token.token,
        systemPrompt,
        userMessage,
      );
    },
  };
}
