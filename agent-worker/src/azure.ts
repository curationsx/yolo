/**
 * Azure OpenAI chat call — v1 endpoint path, API-key auth.
 * Mirrors the caps philosophy of foundry-sim/foundry_client.py, tightened
 * for a public surface: mini deployment only, hard output-token ceiling.
 */

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  maxOutputTokens: number;
}

export interface ChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function chat(
  cfg: AzureConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<ChatResult> {
  if (!/mini/i.test(cfg.deployment)) {
    // Public gateway only ever speaks to the mini tier. Refuse anything else.
    throw new Error("gateway restricted to mini-tier deployments");
  }
  const res = await fetch(`${cfg.endpoint}/openai/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "api-key": cfg.apiKey,
    },
    body: JSON.stringify({
      model: cfg.deployment,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: Math.min(cfg.maxOutputTokens, 512),
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
