/**
 * CURATIONS agent gateway — Cloudflare Worker.
 *
 * The only door between the public internet and our Azure resources.
 * Browsers never see keys; this Worker holds them and enforces the caps:
 *
 *   - mini-tier deployment only, ≤512 output tokens per answer
 *   - per-IP daily limit + global daily kill-switch (KV counters)
 *   - question length cap, persona allowlist, CORS origin allowlist
 *   - every AI reply is labeled with its persona + disclosure line
 *   - every engagement (both lanes) is written to Cosmos for the public feed
 *
 * Routes:
 *   POST /api/ask   { tool_id, lane: "prd-check" | "community", message, author_name? }
 *   GET  /api/feed?tool={tool_id}&limit=20
 */

import { chat, type AzureConfig } from "./azure";
import { createDocument, queryDocuments, type CosmosConfig } from "./cosmos";
import cloudflareGuide from "../personas/cloudflare-guide.json";
import supabaseGuide from "../personas/supabase-guide.json";

interface Env {
  AZURE_OPENAI_API_KEY: string;
  COSMOS_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  COSMOS_ENDPOINT: string;
  COSMOS_DATABASE: string;
  COSMOS_CONTAINER: string;
  ALLOWED_ORIGINS: string;
  MAX_QUESTION_CHARS: string;
  MAX_OUTPUT_TOKENS: string;
  PER_IP_DAILY_LIMIT: string;
  GLOBAL_DAILY_LIMIT: string;
  RATE: KVNamespace;
}

interface Persona {
  id: string;
  display_name: string;
  tool_id: string;
  disclosure: string;
  system_prompt: string;
}

const PERSONAS: Record<string, Persona> = {
  cloudflare: cloudflareGuide as Persona,
  supabase: supabaseGuide as Persona,
};

const LANES = new Set(["prd-check", "community"]);

/** Feed documents are shaped for public consumption — no IPs, no keys. */
interface EngagementDoc {
  id: string;
  tool_id: string;
  lane: string;
  author_name: string;
  author_type: "human" | "agent";
  message: string;
  reply_persona: string | null;
  reply_display_name: string | null;
  reply_disclosure: string | null;
  reply_text: string | null;
  model: string | null;
  completion_tokens: number;
  created_at: string;
}

function corsHeaders(origin: string, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const allow = allowed.includes(origin) ? origin : allowed[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

/** Increment a daily KV counter; returns the new count. TTL rolls at UTC midnight. */
async function bumpCounter(kv: KVNamespace, key: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const fullKey = `${key}:${today}`;
  const current = parseInt((await kv.get(fullKey)) ?? "0", 10) + 1;
  // Seconds until UTC midnight, +60s grace so the key outlives its day.
  const secondsLeft = Math.ceil((86_400_000 - (Date.now() % 86_400_000)) / 1000) + 60;
  await kv.put(fullKey, String(current), { expirationTtl: Math.max(secondsLeft, 60) });
  return current;
}

function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  return name.replace(/[<>&"']/g, "") || "Anonymous";
}

async function handleAsk(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: {
    tool_id?: string;
    lane?: string;
    message?: string;
    author_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400, cors);
  }

  const persona = PERSONAS[body.tool_id ?? ""];
  if (!persona) return json({ error: "unknown tool_id" }, 400, cors);
  const lane = body.lane ?? "";
  if (!LANES.has(lane)) return json({ error: "lane must be prd-check or community" }, 400, cors);

  const message = (body.message ?? "").trim();
  const maxChars = parseInt(env.MAX_QUESTION_CHARS, 10);
  if (!message) return json({ error: "message is required" }, 400, cors);
  if (message.length > maxChars) {
    return json({ error: `message exceeds ${maxChars} characters` }, 400, cors);
  }

  // ── Caps: global kill-switch first, then per-IP ──
  const globalCount = await bumpCounter(env.RATE, "global");
  if (globalCount > parseInt(env.GLOBAL_DAILY_LIMIT, 10)) {
    return json(
      { error: "The community agents have reached today's capacity. Back tomorrow!" },
      429,
      cors,
    );
  }
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const ipCount = await bumpCounter(env.RATE, `ip:${ip}`);
  if (ipCount > parseInt(env.PER_IP_DAILY_LIMIT, 10)) {
    return json({ error: "Daily limit reached for your connection. Back tomorrow!" }, 429, cors);
  }

  // ── Ask the persona ──
  const azure: AzureConfig = {
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    deployment: env.AZURE_OPENAI_DEPLOYMENT,
    maxOutputTokens: parseInt(env.MAX_OUTPUT_TOKENS, 10),
  };
  const laneHint =
    lane === "prd-check"
      ? "Lane: PRD-check. The visitor is describing their product/PRD."
      : "Lane: community share. The visitor is sharing usage or a prompt.";
  let reply;
  try {
    reply = await chat(azure, persona.system_prompt, `${laneHint}\n\n${message}`);
  } catch (err) {
    console.error("azure chat failed", err);
    return json({ error: "The persona is unavailable right now. Try again shortly." }, 502, cors);
  }

  // ── Record the engagement for the public feed ──
  const doc: EngagementDoc = {
    id: crypto.randomUUID(),
    tool_id: persona.tool_id,
    lane,
    author_name: sanitizeName(body.author_name),
    author_type: "human",
    message,
    reply_persona: persona.id,
    reply_display_name: persona.display_name,
    reply_disclosure: persona.disclosure,
    reply_text: reply.text,
    model: env.AZURE_OPENAI_DEPLOYMENT,
    completion_tokens: reply.completionTokens,
    created_at: new Date().toISOString(),
  };
  const cosmos: CosmosConfig = {
    endpoint: env.COSMOS_ENDPOINT,
    key: env.COSMOS_KEY,
    database: env.COSMOS_DATABASE,
    container: env.COSMOS_CONTAINER,
  };
  try {
    await createDocument(cosmos, doc as unknown as Record<string, unknown>, persona.tool_id);
  } catch (err) {
    // Feed write failure should not eat the user's answer.
    console.error("cosmos write failed", err);
  }

  return json(
    {
      persona: persona.display_name,
      disclosure: persona.disclosure,
      reply: reply.text,
      engagement_id: doc.id,
    },
    200,
    cors,
  );
}

async function handleFeed(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const tool = url.searchParams.get("tool") ?? "";
  if (!PERSONAS[tool]) return json({ error: "unknown tool" }, 400, cors);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  const cosmos: CosmosConfig = {
    endpoint: env.COSMOS_ENDPOINT,
    key: env.COSMOS_KEY,
    database: env.COSMOS_DATABASE,
    container: env.COSMOS_CONTAINER,
  };
  try {
    const docs = await queryDocuments<EngagementDoc>(
      cosmos,
      "SELECT TOP @limit c.id, c.tool_id, c.lane, c.author_name, c.author_type, " +
        "c.message, c.reply_persona, c.reply_display_name, c.reply_disclosure, " +
        "c.reply_text, c.created_at FROM c WHERE c.tool_id = @tool ORDER BY c.created_at DESC",
      [
        { name: "@limit", value: limit },
        { name: "@tool", value: tool },
      ],
      tool,
    );
    return json({ tool, engagements: docs }, 200, {
      ...cors,
      "cache-control": "public, max-age=30",
    });
  } catch (err) {
    console.error("cosmos query failed", err);
    return json({ error: "feed unavailable" }, 502, cors);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req.headers.get("origin") ?? "", env);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/api/ask" && req.method === "POST") return handleAsk(req, env, cors);
    if (url.pathname === "/api/feed" && req.method === "GET") return handleFeed(url, env, cors);
    if (url.pathname === "/api/health") return json({ ok: true }, 200, cors);
    return json({ error: "not found" }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
