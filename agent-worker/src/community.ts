/**
 * CURATIONS community API.
 *
 * Public reads; GitHub-authenticated writes. The information hierarchy borrows
 * the useful parts of discussion boards such as Lobsters (score rail, compact
 * metadata, tags, threaded replies) while all markup and visual design remain
 * original CURATIONS work.
 */

import {
  getSession,
  resolvedAllowedOrigin,
  type AuthSession,
} from "./auth.ts";
import type { ChatResult } from "./platform/contracts.ts";
import type { Env, Persona } from "./env.ts";
import {
  verifyPublicRepository,
  type RepositoryEvidence,
} from "./repository-verification.ts";
import cloudflareGuide from "../personas/cloudflare-guide.json" with { type: "json" };
import langfuseGuide from "../personas/langfuse-guide.json" with { type: "json" };
import n8nGuide from "../personas/n8n-guide.json" with { type: "json" };
import obsidianGuide from "../personas/obsidian-guide.json" with { type: "json" };
import ollamaGuide from "../personas/ollama-guide.json" with { type: "json" };
import supabaseGuide from "../personas/supabase-guide.json" with { type: "json" };

export const PERSONAS: Record<string, Persona> = {
  cloudflare: cloudflareGuide as Persona,
  langfuse: langfuseGuide as Persona,
  n8n: n8nGuide as Persona,
  obsidian: obsidianGuide as Persona,
  ollama: ollamaGuide as Persona,
  supabase: supabaseGuide as Persona,
};

const LANES = new Set(["prd-check", "community"]);
const LEGACY_FEED_LIMIT = 20;
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VOTE_TARGET_PATTERN =
  /^(?:software:[a-z0-9]+(?:-[a-z0-9]+)*|(?:discussion|comment):[a-z0-9]+(?:-[a-z0-9]+)*:[0-9a-f-]{36})$/;
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const THREADS_PER_DAY = 8;
const COMMENTS_PER_DAY = 25;
const VOTES_PER_USER_PER_DAY = 200;
const VOTES_PER_IP_PER_DAY = 400;
const VOTES_GLOBAL_PER_DAY = 5000;

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
  published?: boolean;
}

interface ScoreDoc {
  id: string;
  scope: "global";
  target_id: string;
  count: number;
  updated_at: string;
}

interface VoteDoc {
  id: string;
  target_id: string;
  user_id: string;
  created_at: string;
}

interface DiscussionDoc {
  id: string;
  kind: "thread" | "comment";
  tool_id: string;
  thread_id: string;
  parent_id: string | null;
  title: string | null;
  body: string;
  tags: string[];
  author_type: "human" | "agent";
  author_id: string;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_url: string | null;
  author_disclosure: string | null;
  artifact_kind?: "discussion" | "public-prd";
  repository?: RepositoryEvidence | null;
  prd_url?: string | null;
  request_fingerprint?: string | null;
  created_at: string;
}

class CapacityError extends Error {
  status: number;

  constructor(message: string, status = 429) {
    super(message);
    this.status = status;
  }
}

export function corsHeaders(origin: string, env: Env): Record<string, string> {
  const allow = resolvedAllowedOrigin(origin, env.ALLOWED_ORIGINS);
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors,
      ...headers,
    },
  });
}

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function cleanText(raw: unknown, maxLength: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, maxLength) : "";
}

function getPersona(toolId: string): Persona | undefined {
  return Object.hasOwn(PERSONAS, toolId) ? PERSONAS[toolId] : undefined;
}

function useDurableVotes(env: Env): boolean {
  return env.VOTE_BACKEND !== "kv";
}

async function legacyViewerVotes(
  env: Env,
  userId: string,
  targets: string[],
): Promise<string[]> {
  const votes = (await env.RATE.get<string[]>(`user-votes:${userId}`, "json")) ?? [];
  return votes.filter((target) => targets.includes(target));
}

function isOversized(raw: unknown, maxLength: number): boolean {
  return typeof raw === "string" && raw.trim().length > maxLength;
}

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => TAG_PATTERN.test(value)),
    ),
  ].slice(0, 3);
}

async function hashIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function requestFingerprint(
  toolId: string,
  lane: string,
  message: string,
  userId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${toolId}\n${lane}\n${message}\n${userId}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function requireSession(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<AuthSession | Response> {
  const session = await getSession(req, env);
  return session ?? json({ error: "GitHub sign-in required." }, 401, cors);
}

async function checkAgentCapacity(req: Request, env: Env, userId?: string): Promise<void> {
  const ip = env.requestMetadata.clientIp(req);
  const personalLimit = parseInt(env.PER_IP_DAILY_LIMIT, 10);
  const rules = [
    ...(userId ? [{ key: `agent:user:${userId}`, limit: personalLimit }] : []),
    { key: `agent:ip:${await hashIdentifier(ip)}`, limit: personalLimit },
    { key: "agent:global", limit: parseInt(env.GLOBAL_DAILY_LIMIT, 10) },
  ];
  const reservation = await env.quota.reserve(rules);
  if (!reservation.allowed) {
    const global = reservation.blocked_key === "agent:global";
    throw new CapacityError(
      global
        ? "The community agents have reached today's capacity. Back tomorrow!"
        : "Daily agent limit reached for your account or connection. Back tomorrow!",
    );
  }
}

async function invokePersona(
  req: Request,
  env: Env,
  persona: Persona,
  message: string,
  userId?: string,
  outputTokens?: number,
): Promise<ChatResult> {
  await checkAgentCapacity(req, env, userId);
  const maxOutputTokens = Math.min(
    outputTokens ?? parseInt(env.MAX_OUTPUT_TOKENS, 10),
    parseInt(env.MAX_OUTPUT_TOKENS, 10),
  );
  return env.agentModel.chat(persona.system_prompt, message, maxOutputTokens);
}

function humanAuthor(session: AuthSession): Pick<
  DiscussionDoc,
  | "author_type"
  | "author_id"
  | "author_name"
  | "author_login"
  | "author_avatar"
  | "author_url"
  | "author_disclosure"
> {
  return {
    author_type: "human",
    author_id: `github:${session.user.id}`,
    author_name: session.user.name || session.user.login,
    author_login: session.user.login,
    author_avatar: session.user.avatar_url,
    author_url: session.user.html_url,
    author_disclosure: null,
  };
}

function agentAuthor(persona: Persona): Pick<
  DiscussionDoc,
  | "author_type"
  | "author_id"
  | "author_name"
  | "author_login"
  | "author_avatar"
  | "author_url"
  | "author_disclosure"
> {
  return {
    author_type: "agent",
    author_id: `agent:${persona.id}`,
    author_name: persona.display_name,
    author_login: persona.id,
    author_avatar: null,
    author_url: null,
    author_disclosure: persona.disclosure,
  };
}

async function writeThread(
  env: Env,
  toolId: string,
  title: string,
  body: string,
  tags: string[],
  author: ReturnType<typeof humanAuthor> | ReturnType<typeof agentAuthor>,
  requestedId?: string,
  requestFingerprintValue?: string,
  artifact?: {
    kind: "discussion" | "public-prd";
    repository: RepositoryEvidence | null;
    prdUrl: string | null;
  },
): Promise<DiscussionDoc> {
  const id = requestedId ?? crypto.randomUUID();
  const doc: DiscussionDoc = {
    id,
    kind: "thread",
    tool_id: toolId,
    thread_id: id,
    parent_id: null,
    title,
    body,
    tags,
    ...author,
    artifact_kind: artifact?.kind ?? "discussion",
    repository: artifact?.repository ?? null,
    prd_url: artifact?.prdUrl ?? null,
    request_fingerprint: requestFingerprintValue ?? null,
    created_at: new Date().toISOString(),
  };
  await env.community.createDocument(env.COSMOS_DISCUSSIONS_CONTAINER, doc, toolId);
  return doc;
}

async function writeComment(
  env: Env,
  toolId: string,
  threadId: string,
  parentId: string | null,
  body: string,
  author: ReturnType<typeof humanAuthor> | ReturnType<typeof agentAuthor>,
): Promise<DiscussionDoc> {
  const doc: DiscussionDoc = {
    id: crypto.randomUUID(),
    kind: "comment",
    tool_id: toolId,
    thread_id: threadId,
    parent_id: parentId,
    title: null,
    body,
    tags: [],
    ...author,
    created_at: new Date().toISOString(),
  };
  await env.community.createDocument(env.COSMOS_DISCUSSIONS_CONTAINER, doc, toolId);
  return doc;
}

function voteTargetFor(doc: DiscussionDoc): string {
  return `${doc.kind === "thread" ? "discussion" : "comment"}:${doc.tool_id}:${doc.id}`;
}

async function voteTargetExists(env: Env, targetId: string): Promise<boolean> {
  const [kind, toolOrId, maybeId] = targetId.split(":");
  if (kind === "software") {
    return env.SOFTWARE_TARGETS.split(",").includes(toolOrId);
  }
  if ((kind !== "discussion" && kind !== "comment") || !maybeId || !getPersona(toolOrId)) {
    return false;
  }
  const doc = await env.community.readDocument<DiscussionDoc>(
    env.COSMOS_DISCUSSIONS_CONTAINER,
    maybeId,
    toolOrId,
  );
  return Boolean(doc && doc.kind === (kind === "discussion" ? "thread" : "comment"));
}

async function setLegacyVote(
  env: Env,
  targetId: string,
  userId: string,
  voted: boolean,
): Promise<{ target_id: string; voted: boolean; count: number }> {
  const voteId = `github-${userId}`;
  const existing = await env.community.readDocument<VoteDoc>(
    env.COSMOS_VOTES_CONTAINER,
    voteId,
    targetId,
  );

  if (voted && !existing) {
    await env.community.createDocument(
      env.COSMOS_VOTES_CONTAINER,
      {
        id: voteId,
        target_id: targetId,
        user_id: userId,
        created_at: new Date().toISOString(),
      },
      targetId,
    );
  } else if (!voted && existing) {
    await env.community.deleteDocument(env.COSMOS_VOTES_CONTAINER, voteId, targetId);
  }

  const countResult = await env.community.queryDocuments<number>(
    env.COSMOS_VOTES_CONTAINER,
    "SELECT VALUE COUNT(1) FROM c",
    [],
    targetId,
  );
  const count = countResult[0] ?? 0;
  await env.community.upsertDocument(
    env.COSMOS_SCORES_CONTAINER,
    {
      id: targetId,
      scope: "global",
      target_id: targetId,
      count,
      updated_at: new Date().toISOString(),
    },
    "global",
  );

  const userVotes = new Set(
    (await env.RATE.get<string[]>(`user-votes:${userId}`, "json")) ?? [],
  );
  if (voted) userVotes.add(targetId);
  else userVotes.delete(targetId);
  await env.RATE.put(`user-votes:${userId}`, JSON.stringify([...userVotes]));
  return { target_id: targetId, voted, count };
}

async function voteSummary(
  env: Env,
  targets: string[],
  session: AuthSession | null,
): Promise<{ counts: Record<string, number>; viewer_votes: string[] }> {
  const unique = [...new Set(targets.filter((target) => VOTE_TARGET_PATTERN.test(target)))];
  if (!unique.length) return { counts: {}, viewer_votes: [] };

  let counts: Record<string, number>;
  if (useDurableVotes(env)) {
    // Durable mode: read through the VoteStore contract so Azure reads its
    // own same-partition score metadata (kept current by setVote's
    // transactional batch) instead of the legacy `scores` container,
    // which Azure never writes to. Cloudflare's adapter still reads the
    // legacy container — unchanged, since its durable VoteGuard keeps it
    // current on every vote.
    counts = await env.votes.getCounts(unique);
  } else {
    counts = {};
    for (let offset = 0; offset < unique.length; offset += 100) {
      const chunk = unique.slice(offset, offset + 100);
      const parameters = chunk.map((target, index) => ({
        name: `@target${index}`,
        value: target,
      }));
      const placeholders = parameters.map((parameter) => parameter.name).join(", ");
      const rows = await env.community.queryDocuments<Pick<ScoreDoc, "target_id" | "count">>(
        env.COSMOS_SCORES_CONTAINER,
        `SELECT c.target_id, c.count FROM c WHERE c.target_id IN (${placeholders})`,
        parameters,
        "global",
      );
      for (const row of rows) counts[row.target_id] = row.count;
    }
  }
  const viewerVotes = session
    ? useDurableVotes(env)
      ? await env.votes.getViewerVotes(session.user.id, unique)
      : await legacyViewerVotes(env, session.user.id, unique)
    : [];
  return {
    counts,
    viewer_votes: viewerVotes,
  };
}


export async function handleVotes(
  req: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const targets = (url.searchParams.get("targets") ?? "")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
  if (!targets.length || targets.length > 100 || targets.some((target) => !VOTE_TARGET_PATTERN.test(target))) {
    return json({ error: "targets must contain 1-100 valid target ids" }, 400, cors);
  }
  try {
    const summary = await voteSummary(env, targets, await getSession(req, env));
    return json(summary, 200, cors, { "cache-control": "private, max-age=10" });
  } catch (error) {
    console.error("vote summary failed", error);
    return json({ error: "votes unavailable" }, 502, cors);
  }
}

export async function handleVoteSet(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const body = await parseBody<{ target_id?: string; voted?: boolean }>(req);
  if (isOversized(body?.target_id, 100)) return json({ error: "target_id is too long" }, 400, cors);
  const targetId = cleanText(body?.target_id, 100);
  if (!VOTE_TARGET_PATTERN.test(targetId)) return json({ error: "invalid target_id" }, 400, cors);
  if (typeof body?.voted !== "boolean") {
    return json({ error: "voted must be true or false" }, 400, cors);
  }
  return applyVoteMutation(req, env, cors, auth, targetId, body.voted);
}

async function applyVoteMutation(
  req: Request,
  env: Env,
  cors: Record<string, string>,
  auth: AuthSession,
  targetId: string,
  voted: boolean,
): Promise<Response> {
  try {
    if (!(await voteTargetExists(env, targetId))) {
      return json({ error: "vote target not found" }, 404, cors);
    }
    const ipHash = await hashIdentifier(env.requestMetadata.clientIp(req));
    const personal = await env.quota.reserve([
      { key: `vote:user:${auth.user.id}`, limit: VOTES_PER_USER_PER_DAY },
      { key: `vote:ip:${ipHash}`, limit: VOTES_PER_IP_PER_DAY },
    ]);
    if (!personal.allowed) return json({ error: "daily vote limit reached" }, 429, cors);
    const global = await env.quota.reserve([
      { key: "vote:global", limit: VOTES_GLOBAL_PER_DAY },
    ]);
    if (!global.allowed) return json({ error: "community voting is at daily capacity" }, 429, cors);

    const result = useDurableVotes(env)
      ? await env.votes.setVote(targetId, auth.user.id, voted)
      : await setLegacyVote(env, targetId, auth.user.id, voted);
    return json(result, 200, cors);
  } catch (error) {
    console.error("vote set failed", error);
    return json({ error: "vote could not be saved" }, 502, cors);
  }
}

export async function handleVoteToggle(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const body = await parseBody<{ target_id?: string }>(req);
  if (isOversized(body?.target_id, 100)) {
    return json({ error: "target_id is too long" }, 400, cors);
  }
  const targetId = cleanText(body?.target_id, 100);
  if (!VOTE_TARGET_PATTERN.test(targetId)) {
    return json({ error: "invalid target_id" }, 400, cors);
  }
  try {
    const viewerVotes = useDurableVotes(env)
      ? await env.votes.getViewerVotes(auth.user.id, [targetId])
      : await legacyViewerVotes(env, auth.user.id, [targetId]);
    return applyVoteMutation(
      req,
      env,
      cors,
      auth,
      targetId,
      !viewerVotes.includes(targetId),
    );
  } catch (error) {
    console.error("legacy vote toggle failed", error);
    return json({ error: "vote could not be saved" }, 502, cors);
  }
}

export async function handleDiscussions(
  req: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const toolId = url.searchParams.get("tool") ?? "";
  if (!getPersona(toolId)) return json({ error: "unknown tool" }, 400, cors);
  try {
    const threads = await env.community.queryDocuments<DiscussionDoc>(
      env.COSMOS_DISCUSSIONS_CONTAINER,
      "SELECT TOP 40 * FROM c WHERE c.tool_id = @tool AND c.kind = @kind ORDER BY c.created_at DESC",
      [
        { name: "@tool", value: toolId },
        { name: "@kind", value: "thread" },
      ],
      toolId,
    );
    const threadParameters = threads.map((thread, index) => ({
      name: `@thread${index}`,
      value: thread.id,
    }));
    const comments = threadParameters.length
      ? await env.community.queryDocuments<DiscussionDoc>(
          env.COSMOS_DISCUSSIONS_CONTAINER,
          `SELECT TOP 160 * FROM c WHERE c.tool_id = @tool AND c.kind = @kind ` +
            `AND c.thread_id IN (${threadParameters.map(({ name }) => name).join(", ")}) ` +
            "ORDER BY c.created_at ASC",
          [
            { name: "@tool", value: toolId },
            { name: "@kind", value: "comment" },
            ...threadParameters,
          ],
          toolId,
        )
      : [];
    const session = await getSession(req, env);
    const summary = await voteSummary(
      env,
      [...threads, ...comments].map(voteTargetFor),
      session,
    );
    const renderedThreads = threads
      .map((thread) => ({
        ...thread,
        score: summary.counts[voteTargetFor(thread)] ?? 0,
        viewer_voted: summary.viewer_votes.includes(voteTargetFor(thread)),
        comments: comments
          .filter((comment) => comment.thread_id === thread.id)
          .map((comment) => ({
            ...comment,
            score: summary.counts[voteTargetFor(comment)] ?? 0,
            viewer_voted: summary.viewer_votes.includes(voteTargetFor(comment)),
          }))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({ tool: toolId, threads: renderedThreads }, 200, cors, {
      "cache-control": session ? "private, max-age=5" : "public, max-age=20",
    });
  } catch (error) {
    console.error("discussion query failed", error);
    return json({ error: "discussion board unavailable" }, 502, cors);
  }
}

export async function handleCreateDiscussion(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const body = await parseBody<{
    tool_id?: string;
    title?: string;
    body?: string;
    tags?: unknown;
    invite_agent?: boolean;
    artifact_kind?: string;
    repository_url?: string;
    prd_url?: string;
    stack_path?: string;
  }>(req);
  if (
    isOversized(body?.tool_id, 64) ||
    isOversized(body?.title, 120) ||
    isOversized(body?.body, 4000) ||
    isOversized(body?.artifact_kind, 32) ||
    isOversized(body?.repository_url, 300) ||
    isOversized(body?.prd_url, 500) ||
    isOversized(body?.stack_path, 160)
  ) {
    return json({ error: "discussion input exceeds the allowed length" }, 400, cors);
  }
  const toolId = cleanText(body?.tool_id, 64);
  const title = cleanText(body?.title, 120);
  const message = cleanText(body?.body, 4000);
  const artifactKind = cleanText(body?.artifact_kind, 32) || "discussion";
  const repositoryUrl = cleanText(body?.repository_url, 300);
  const prdUrl = cleanText(body?.prd_url, 500);
  const stackPath = cleanText(body?.stack_path, 160);
  const persona = getPersona(toolId);
  if (!persona || !TOOL_ID_PATTERN.test(toolId)) return json({ error: "unknown tool_id" }, 400, cors);
  if (artifactKind !== "discussion" && artifactKind !== "public-prd") {
    return json({ error: "artifact_kind must be discussion or public-prd" }, 400, cors);
  }
  if (artifactKind === "public-prd" && !repositoryUrl) {
    return json({ error: "A public GitHub repository is required for PRD verification." }, 400, cors);
  }
  if (title.length < 8) return json({ error: "title must be at least 8 characters" }, 400, cors);
  if (message.length < 12) return json({ error: "discussion must be at least 12 characters" }, 400, cors);
  let repository: RepositoryEvidence | null = null;
  let normalizedPrdUrl: string | null = null;
  if (artifactKind === "public-prd") {
    const verification = await verifyPublicRepository(
      toolId,
      repositoryUrl,
      prdUrl,
      stackPath,
      auth.user.login,
      env.GITHUB_REPOSITORY_TOKEN,
    );
    if (!verification.ok) {
      return json({ error: verification.error }, verification.status, cors);
    }
    repository = verification.evidence;
    normalizedPrdUrl = verification.prdUrl;
  }

  const quota = await env.quota.reserve([
    { key: `community:thread:${auth.user.id}`, limit: THREADS_PER_DAY },
  ]);
  if (!quota.allowed) return json({ error: "daily discussion limit reached" }, 429, cors);

  try {
    const tags =
      artifactKind === "public-prd"
        ? ["public-prd", "stack-proof", ...cleanTags(body?.tags)].slice(0, 3)
        : cleanTags(body?.tags);
    const thread = await writeThread(
      env,
      toolId,
      title,
      message,
      tags,
      humanAuthor(auth),
      undefined,
      undefined,
      {
        kind: artifactKind,
        repository,
        prdUrl: normalizedPrdUrl,
      },
    );
    let agentComment: DiscussionDoc | null = null;
    let agentError: string | null = null;
    if (body?.invite_agent !== false) {
      try {
        const evidenceContext =
          artifactKind === "public-prd" && repository
            ? `This is a public PRD and repository evidence thread.\n` +
              `Repository: ${repository.url}\n` +
              `Automated status: ${repository.automated_status}\n` +
              `Matched markers: ${repository.checks
                .filter((check) => check.matched)
                .map((check) => `${check.label} (${check.path})`)
                .join(", ") || "none"}\n` +
              `PRD link: ${normalizedPrdUrl ?? "not supplied"}\n` +
              `Do not offer to build, edit, or deploy for the user. Treat automated checks as narrow evidence, not a full audit.\n`
            : "This is a general public community discussion.\n";
        const reply = await invokePersona(
          req,
          env,
          persona,
          `Lane: public community discussion.\n${evidenceContext}Thread title: ${title}\n` +
            `Human post: ${message}\n\nReply as the first discussion comment. Be concise, ` +
            `concrete, and label each claim as fact, assumption, suggestion, or question. ` +
            `Add one useful verification question.`,
          auth.user.id,
          320,
        );
        agentComment = await writeComment(
          env,
          toolId,
          thread.id,
          null,
          reply.text,
          agentAuthor(persona),
        );
      } catch (error) {
        agentError = error instanceof Error ? error.message : "Agent unavailable";
      }
    }
    return json({ thread, agent_comment: agentComment, agent_error: agentError }, 201, cors);
  } catch (error) {
    console.error("discussion create failed", error);
    return json({ error: "discussion could not be published" }, 502, cors);
  }
}

export async function handleCreateComment(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const body = await parseBody<{
    tool_id?: string;
    thread_id?: string;
    parent_id?: string | null;
    body?: string;
    invite_agent?: boolean;
  }>(req);
  if (
    isOversized(body?.tool_id, 64) ||
    isOversized(body?.thread_id, 64) ||
    isOversized(body?.parent_id, 64) ||
    isOversized(body?.body, 3000)
  ) {
    return json({ error: "reply input exceeds the allowed length" }, 400, cors);
  }
  const toolId = cleanText(body?.tool_id, 64);
  const threadId = cleanText(body?.thread_id, 64);
  const parentId = cleanText(body?.parent_id, 64) || null;
  const message = cleanText(body?.body, 3000);
  const persona = getPersona(toolId);
  if (!persona || !TOOL_ID_PATTERN.test(toolId)) return json({ error: "unknown tool_id" }, 400, cors);
  if (!/^[0-9a-f-]{36}$/.test(threadId)) return json({ error: "invalid thread_id" }, 400, cors);
  if (parentId && !/^[0-9a-f-]{36}$/.test(parentId)) return json({ error: "invalid parent_id" }, 400, cors);
  if (message.length < 2) return json({ error: "reply is required" }, 400, cors);
  try {
    const thread = await env.community.readDocument<DiscussionDoc>(
      env.COSMOS_DISCUSSIONS_CONTAINER,
      threadId,
      toolId,
    );
    if (!thread || thread.kind !== "thread") return json({ error: "thread not found" }, 404, cors);
    if (parentId) {
      const parent = await env.community.readDocument<DiscussionDoc>(
        env.COSMOS_DISCUSSIONS_CONTAINER,
        parentId,
        toolId,
      );
      if (!parent || parent.thread_id !== threadId) return json({ error: "parent reply not found" }, 404, cors);
    }

    const quota = await env.quota.reserve([
      { key: `community:comment:${auth.user.id}`, limit: COMMENTS_PER_DAY },
    ]);
    if (!quota.allowed) return json({ error: "daily reply limit reached" }, 429, cors);

    const comment = await writeComment(
      env,
      toolId,
      threadId,
      parentId,
      message,
      humanAuthor(auth),
    );
    let agentComment: DiscussionDoc | null = null;
    let agentError: string | null = null;
    if (body?.invite_agent) {
      try {
        const reply = await invokePersona(
          req,
          env,
          persona,
          `Lane: public community reply.\nThread title: ${thread.title}\n` +
            `Human reply: ${message}\n\nRespond directly to this reply. Keep it under 180 words, ` +
            `offer one concrete improvement, and stay grounded in the company's public docs.`,
          auth.user.id,
          260,
        );
        agentComment = await writeComment(
          env,
          toolId,
          threadId,
          comment.id,
          reply.text,
          agentAuthor(persona),
        );
      } catch (error) {
        agentError = error instanceof Error ? error.message : "Agent unavailable";
      }
    }
    return json({ comment, agent_comment: agentComment, agent_error: agentError }, 201, cors);
  } catch (error) {
    console.error("comment create failed", error);
    return json({ error: "reply could not be published" }, 502, cors);
  }
}

export async function handleAsk(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const body = await parseBody<{
    tool_id?: string;
    lane?: string;
    message?: string;
    publish?: boolean;
    request_id?: string;
  }>(req);
  const maxQuestionChars = parseInt(env.MAX_QUESTION_CHARS, 10);
  if (
    isOversized(body?.tool_id, 64) ||
    isOversized(body?.lane, 32) ||
    isOversized(body?.message, maxQuestionChars) ||
    isOversized(body?.request_id, 36)
  ) {
    return json({ error: "request input exceeds the allowed length" }, 400, cors);
  }
  const persona = getPersona(cleanText(body?.tool_id, 64));
  if (!persona) return json({ error: "unknown tool_id" }, 400, cors);
  const lane = cleanText(body?.lane, 32);
  if (!LANES.has(lane)) return json({ error: "lane must be prd-check or community" }, 400, cors);

  const message = cleanText(body?.message, maxQuestionChars);
  if (!message) return json({ error: "message is required" }, 400, cors);
  const publish = lane === "community" || body?.publish === true;
  const session = await getSession(req, env);
  if (publish && !session) return json({ error: "GitHub sign-in required to publish." }, 401, cors);
  const requestId = cleanText(body?.request_id, 36) || crypto.randomUUID();
  if (publish && !/^[0-9a-f-]{36}$/.test(requestId)) {
    return json({ error: "invalid request_id" }, 400, cors);
  }
  const fingerprint =
    publish && session
      ? await requestFingerprint(persona.tool_id, lane, message, session.user.id)
      : null;

  let existingPublishedThread: DiscussionDoc | null = null;
  if (publish && session) {
    const existing = await env.community.readDocument<DiscussionDoc>(
      env.COSMOS_DISCUSSIONS_CONTAINER,
      requestId,
      persona.tool_id,
    );
    if (existing) {
      if (
        existing.kind !== "thread" ||
        existing.author_id !== `github:${session.user.id}` ||
        existing.request_fingerprint !== fingerprint
      ) {
        return json(
          { error: "request_id already belongs to another published exchange" },
          409,
          cors,
        );
      }
      existingPublishedThread = existing;
      const comments = await env.community.queryDocuments<DiscussionDoc>(
        env.COSMOS_DISCUSSIONS_CONTAINER,
        "SELECT * FROM c WHERE c.tool_id = @tool AND c.thread_id = @thread",
        [
          { name: "@tool", value: persona.tool_id },
          { name: "@thread", value: requestId },
        ],
        persona.tool_id,
      );
      const agentReply = comments.find(
        (comment) => comment.kind === "comment" && comment.author_id === `agent:${persona.id}`,
      );
      if (agentReply) {
        return json(
          {
            persona: persona.display_name,
            disclosure: persona.disclosure,
            reply: agentReply.body,
            published: true,
            thread_id: existing.id,
          },
          200,
          cors,
        );
      }
    }
  }

  const laneHint =
    lane === "prd-check"
      ? "Lane: PRD-check. The visitor is describing their product or PRD."
      : "Lane: public community share. The visitor is sharing usage or a prompt.";
  let reply: ChatResult;
  try {
    reply = await invokePersona(req, env, persona, `${laneHint}\n\n${message}`, session?.user.id);
  } catch (error) {
    if (error instanceof CapacityError) return json({ error: error.message }, error.status, cors);
    console.error("azure chat failed", error);
    return json({ error: "The persona is unavailable right now. Try again shortly." }, 502, cors);
  }

  let threadId: string | null = null;
  if (publish && session) {
    try {
      const title =
        lane === "prd-check"
          ? `${persona.display_name} reviews a community PRD`
          : message.split(/[.!?\n]/, 1)[0].slice(0, 110) || `${persona.display_name} community thread`;
      const thread =
        existingPublishedThread ??
        (await writeThread(
          env,
          persona.tool_id,
          title,
          message,
          [lane],
          humanAuthor(session),
          requestId,
          fingerprint ?? undefined,
        ));
      threadId = thread.id;
      await writeComment(
        env,
        persona.tool_id,
        thread.id,
        null,
        reply.text,
        agentAuthor(persona),
      );

      const engagement: EngagementDoc = {
        id: requestId,
        tool_id: persona.tool_id,
        lane,
        author_name: session.user.login,
        author_type: "human",
        message,
        reply_persona: persona.id,
        reply_display_name: persona.display_name,
        reply_disclosure: persona.disclosure,
        reply_text: reply.text,
        model: env.AZURE_OPENAI_DEPLOYMENT,
        completion_tokens: reply.completionTokens,
        created_at: new Date().toISOString(),
        published: true,
      };
      await env.community.createDocument(env.COSMOS_CONTAINER, engagement, persona.tool_id);
    } catch (error) {
      console.error("published ask persistence failed", error);
      return json({ error: "The answer was generated but could not be published. Please retry." }, 502, cors);
    }
  }

  return json(
    {
      persona: persona.display_name,
      disclosure: persona.disclosure,
      reply: reply.text,
      published: publish,
      thread_id: threadId,
    },
    200,
    cors,
  );
}

/** Backward-compatible flat feed for clients deployed before the discussion board. */
export async function handleFeed(
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  for (const key of url.searchParams.keys()) {
    if (key !== "tool" && key !== "limit") {
      return json({ error: `unsupported query parameter: ${key}` }, 400, cors);
    }
  }
  if (url.searchParams.getAll("tool").length !== 1 || url.searchParams.getAll("limit").length > 1) {
    return json({ error: "tool must appear once and limit at most once" }, 400, cors);
  }
  const toolId = url.searchParams.get("tool") ?? "";
  if (!getPersona(toolId)) return json({ error: "unknown tool" }, 400, cors);
  const requestedLimit = url.searchParams.get("limit");
  if (requestedLimit !== null && requestedLimit !== String(LEGACY_FEED_LIMIT)) {
    return json({ error: `limit must be ${LEGACY_FEED_LIMIT}` }, 400, cors);
  }
  try {
    const docs = await env.community.queryDocuments<EngagementDoc>(
      env.COSMOS_CONTAINER,
      "SELECT TOP @limit c.id, c.tool_id, c.lane, c.author_name, c.author_type, " +
        "c.message, c.reply_persona, c.reply_display_name, c.reply_disclosure, " +
        "c.reply_text, c.created_at FROM c WHERE c.tool_id = @tool " +
        "AND (c.published = true OR c.lane = @community) ORDER BY c.created_at DESC",
      [
        { name: "@limit", value: LEGACY_FEED_LIMIT },
        { name: "@tool", value: toolId },
        { name: "@community", value: "community" },
      ],
      toolId,
    );
    return json({ tool: toolId, engagements: docs }, 200, cors, {
      "cache-control": "public, max-age=30",
    });
  } catch (error) {
    console.error("legacy feed query failed", error);
    return json({ error: "feed unavailable" }, 502, cors);
  }
}
