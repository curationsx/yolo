import {
  bearerToken,
  copilotAuthConfigured,
  getSession,
  isAllowedOrigin,
} from "./auth.ts";
import {
  consumeCopilotGrant,
  decryptCopilotToken,
  getCopilotGrantStatus,
  revokeCopilotGrant,
} from "./copilot-grant.ts";
import type { Env } from "./env.ts";
import {
  releaseDailyQuota,
  reserveDailyQuota,
  type QuotaRule,
} from "./quota.ts";

const EMBEDDED_PROMPT_PATTERN =
  /^\/copilot\/[a-z0-9]+(?:-[a-z0-9]+)*\/v\d+\.\d+(?:\.\d+)?\/[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/;
const RUN_ID_PATTERN = /^[0-9a-f-]{36}$/;

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors,
    },
  });
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanInstruction(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 2000) : "";
}

async function readEmbeddedPrompt(
  req: Request,
  env: Env,
  promptPath: string,
): Promise<string> {
  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    throw new Error("untrusted prompt origin");
  }
  const response = await fetch(new URL(promptPath, origin), {
    headers: { accept: "text/plain" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`embedded prompt unavailable: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("text/plain")) {
    throw new Error("embedded prompt returned an unexpected content type");
  }
  const maximum = positiveInteger(env.COPILOT_MAX_PROMPT_CHARS, 60_000);
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (declaredLength > maximum) throw new Error("embedded prompt exceeds the allowed length");
  const prompt = await response.text();
  if (!prompt || prompt.length > maximum) {
    throw new Error("embedded prompt exceeds the allowed length");
  }
  return prompt;
}

async function copilotCapacityRules(
  req: Request,
  env: Env,
  userId: string,
): Promise<QuotaRule[]> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip),
  );
  const ipHash = [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [
    {
      key: `copilot:user:${userId}`,
      limit: positiveInteger(env.COPILOT_RUNS_PER_USER_DAILY, 5),
    },
    {
      key: `copilot:ip:${ipHash}`,
      limit: positiveInteger(env.COPILOT_RUNS_PER_IP_DAILY, 10),
    },
    {
      key: "copilot:global",
      limit: positiveInteger(env.COPILOT_RUNS_GLOBAL_DAILY, 100),
    },
  ];
}

async function restoreCopilotCapacity(
  env: Env,
  rules: QuotaRule[],
): Promise<void> {
  try {
    await releaseDailyQuota(env, rules);
  } catch (error) {
    console.error(
      "Copilot quota release failed",
      error instanceof Error ? error.message : "unknown quota error",
    );
  }
}

export async function handleCopilotStatus(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  const sessionToken = bearerToken(req);
  if (!session || !sessionToken) {
    return json(
      {
        configured: copilotAuthConfigured(env),
        connected: false,
        expires_at: null,
      },
      401,
      cors,
    );
  }
  if (!copilotAuthConfigured(env)) {
    return json({ configured: false, connected: false, expires_at: null }, 200, cors);
  }
  const status = await getCopilotGrantStatus(
    { COPILOT_GRANT: env.COPILOT_GRANT },
    sessionToken,
  );
  return json(
    {
      configured: true,
      ...status,
      model: env.COPILOT_MODEL || "gpt-5.4",
      max_ai_credits: positiveInteger(env.COPILOT_MAX_AI_CREDITS, 10),
    },
    200,
    cors,
  );
}

export async function handleCopilotDisconnect(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  const sessionToken = bearerToken(req);
  if (!session || !sessionToken) {
    return json({ error: "GitHub sign-in required." }, 401, cors);
  }
  await revokeCopilotGrant({ COPILOT_GRANT: env.COPILOT_GRANT }, sessionToken);
  return json({ ok: true }, 200, cors);
}

export async function handleCopilotRun(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!copilotAuthConfigured(env)) {
    return json({ error: "Use My Copilot is not configured yet." }, 503, cors);
  }
  const session = await getSession(req, env);
  const sessionToken = bearerToken(req);
  if (!session || !sessionToken) {
    return json({ error: "GitHub sign-in required." }, 401, cors);
  }

  let body: {
    prompt_path?: unknown;
    instruction?: unknown;
    run_id?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid request body" }, 400, cors);
  }
  const promptPath = typeof body.prompt_path === "string" ? body.prompt_path : "";
  const runId = typeof body.run_id === "string" ? body.run_id : "";
  if (!EMBEDDED_PROMPT_PATTERN.test(promptPath) || !RUN_ID_PATTERN.test(runId)) {
    return json({ error: "invalid cookbook run" }, 400, cors);
  }

  const grantStatus = await getCopilotGrantStatus(
    { COPILOT_GRANT: env.COPILOT_GRANT },
    sessionToken,
  );
  if (!grantStatus.connected) {
    return json(
      { error: "Connect your GitHub Copilot plan before running.", code: "connection_required" },
      409,
      cors,
    );
  }

  let embeddedPrompt: string;
  try {
    embeddedPrompt = await readEmbeddedPrompt(req, env, promptPath);
  } catch (error) {
    console.error(
      "embedded Copilot prompt failed",
      error instanceof Error ? error.message : "unknown prompt error",
    );
    return json({ error: "The versioned cookbook prompt is unavailable." }, 502, cors);
  }
  const instruction = cleanInstruction(body.instruction);
  const prompt = instruction
    ? `${embeddedPrompt}\n\n## User focus for this run\n\n${instruction}`
    : embeddedPrompt;
  if (prompt.length > positiveInteger(env.COPILOT_MAX_PROMPT_CHARS, 60_000)) {
    return json({ error: "cookbook prompt exceeds the allowed length" }, 400, cors);
  }

  const capacityRules = await copilotCapacityRules(req, env, session.user.id);
  const capacity = await reserveDailyQuota(env, capacityRules);
  if (!capacity.allowed) {
    return json(
      {
        error:
          capacity.blocked_key === "copilot:global"
            ? "Embedded Copilot has reached today's platform capacity."
            : "Embedded Copilot run limit reached for today.",
      },
      429,
      cors,
    );
  }

  const grant = await consumeCopilotGrant(
    { COPILOT_GRANT: env.COPILOT_GRANT },
    sessionToken,
  );
  if (!grant || grant.user_id !== session.user.id) {
    await restoreCopilotCapacity(env, capacityRules);
    return json(
      { error: "Connect your GitHub Copilot plan before running.", code: "connection_required" },
      409,
      cors,
    );
  }

  let gitHubToken: string;
  try {
    gitHubToken = await decryptCopilotToken(
      grant,
      env.COPILOT_TOKEN_ENCRYPTION_KEY!,
    );
  } catch {
    await restoreCopilotCapacity(env, capacityRules);
    return json(
      { error: "Your one-run Copilot connection expired.", code: "connection_required" },
      409,
      cors,
    );
  }

  const runtimeId = env.COPILOT_RUNTIME.idFromName("shared-v1");
  const runtime = env.COPILOT_RUNTIME.get(runtimeId);
  let response: Response;
  try {
    response = await runtime.fetch(
      new Request("http://copilot-runtime/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gitHubToken,
          prompt,
          runId,
          model: env.COPILOT_MODEL,
          maxAiCredits: positiveInteger(env.COPILOT_MAX_AI_CREDITS, 10),
        }),
        signal: AbortSignal.timeout(150_000),
      }),
    );
  } catch (error) {
    console.error(
      "Copilot container request failed",
      error instanceof Error ? error.message : "unknown container error",
    );
    return json(
      {
        error:
          "GitHub Copilot did not complete this run. Reconnect before trying again.",
        code: "runtime_unavailable",
      },
      502,
      cors,
    );
  }

  let result: { content?: unknown; error?: unknown; code?: unknown; model?: unknown };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    return json({ error: "GitHub Copilot returned an invalid response." }, 502, cors);
  }
  if (!response.ok || typeof result.content !== "string") {
    return json(
      {
        error:
          typeof result.error === "string"
            ? result.error
            : "GitHub Copilot could not complete this run.",
        code: typeof result.code === "string" ? result.code : "copilot_unavailable",
      },
      response.status >= 400 && response.status <= 599 ? response.status : 502,
      cors,
    );
  }
  const maxResponseChars = positiveInteger(env.COPILOT_MAX_RESPONSE_CHARS, 40_000);
  if (result.content.length > maxResponseChars) {
    return json({ error: "GitHub Copilot response exceeded the display limit." }, 502, cors);
  }
  return json(
    {
      content: result.content,
      model: typeof result.model === "string" ? result.model : env.COPILOT_MODEL,
      billing: "github-copilot-user",
      max_ai_credits: positiveInteger(env.COPILOT_MAX_AI_CREDITS, 10),
      connection_consumed: true,
    },
    200,
    cors,
  );
}
