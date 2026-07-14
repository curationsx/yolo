/**
 * Azure OpenAI chat call — v1 endpoint path.
 * Mirrors the caps philosophy of foundry-sim/foundry_client.py, tightened
 * for a public surface: mini deployment only, hard output-token ceiling.
 *
 * Cloudflare authenticates with an API key (`chat`). Azure authenticates
 * with a managed-identity bearer token (`chatWithBearerToken`) — no API key
 * ever exists in the Azure path. Both funnel through the same low-level
 * request so the deployment restriction and response parsing stay identical.
 */

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  maxOutputTokens: number;
}

export interface AzureBearerConfig {
  endpoint: string;
  deployment: string;
  maxOutputTokens: number;
}

export interface ChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

const REQUEST_TIMEOUT_MS = 30_000;
const ALLOWED_DEPLOYMENT = "gpt-5.4-mini";

async function sendChatCompletion(
  endpoint: string,
  deployment: string,
  maxOutputTokens: number,
  authHeaders: Record<string, string>,
  systemPrompt: string,
  userMessage: string,
): Promise<ChatResult> {
  if (deployment !== ALLOWED_DEPLOYMENT) {
    throw new Error("gateway restricted to the gpt-5.4-mini deployment");
  }
  const res = await fetch(`${endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      model: deployment,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: Math.min(maxOutputTokens, 512),
    }),
  });
  if (!res.ok) {
    throw new Error(`azure openai error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? "",
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Cloudflare path: API-key auth. */
export async function chat(
  cfg: AzureConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<ChatResult> {
  return sendChatCompletion(
    cfg.endpoint,
    cfg.deployment,
    cfg.maxOutputTokens,
    { "api-key": cfg.apiKey },
    systemPrompt,
    userMessage,
  );
}

/** Azure path: managed-identity bearer token, never an API key. */
export async function chatWithBearerToken(
  cfg: AzureBearerConfig,
  bearerToken: string,
  systemPrompt: string,
  userMessage: string,
): Promise<ChatResult> {
  return sendChatCompletion(
    cfg.endpoint,
    cfg.deployment,
    cfg.maxOutputTokens,
    { authorization: `Bearer ${bearerToken}` },
    systemPrompt,
    userMessage,
  );
}
