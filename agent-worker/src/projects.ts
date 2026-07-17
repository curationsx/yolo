import { getSession, type AuthSession } from "./auth.ts";
import { json } from "./community.ts";
import type { Env } from "./env.ts";
import {
  inspectProjectRepository,
  type ProjectRepositoryInspection,
  type ProjectToolClaim,
  type ProjectToolInput,
} from "./repository-verification.ts";

const PREVIEW_TTL_SECONDS = 15 * 60;
const PREVIEWS_PER_USER_DAILY = 20;
const PREVIEWS_PER_IP_DAILY = 40;
const PREVIEWS_GLOBAL_DAILY = 500;
const CREATES_PER_USER_DAILY = 5;
const CREATES_PER_IP_DAILY = 10;
const CREATES_GLOBAL_DAILY = 100;
const MAX_PROJECT_BODY_BYTES = 300_000;
const PROJECT_PILOT_TOOLS = new Set(["cloudflare", "supabase"]);
const PROJECT_TYPES = new Set([
  "crm-and-operations",
  "research-and-knowledge",
  "creative-tools",
  "commerce-and-finance",
  "community-and-events",
  "developer-tools",
  "ai-assistants",
]);
const PREVIEW_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_ID_PATTERN = /^github-repository:[1-9][0-9]{0,19}$/;

interface ProjectPreviewInput {
  repository_url?: unknown;
  prd_path?: unknown;
  summary?: unknown;
  question?: unknown;
  project_type?: unknown;
  approved_excerpt?: unknown;
  tools?: unknown;
}

export interface ProjectPreview {
  project_id: string;
  repository: ProjectRepositoryInspection["repository"];
  submitted_by: {
    github_user_id: string;
    login: string;
  };
  summary: string;
  question: string;
  project_type: string;
  status: "preview";
  snapshot: {
    id: string;
    repository_commit: string;
    default_branch: string;
    prd: ProjectRepositoryInspection["prd"] & {
      approved_excerpt: string | null;
    };
    checker_version: ProjectRepositoryInspection["checker_version"];
    checked_at: string;
    fresh_until: string;
    limitations: string[];
  };
  claims: ProjectToolClaim[];
  limitations: string[];
}

interface StoredProjectPreview {
  user_id: string;
  expires_at: string;
  preview: ProjectPreview;
}

interface CreateProjectInput {
  project_id?: unknown;
  preview_version?: unknown;
  preview_consistency_token?: unknown;
  request_id?: unknown;
  consent?: unknown;
}

interface ProjectDocument {
  id: string;
  project_id: string;
  tool_id: string;
  kind: "project";
  repository: ProjectPreview["repository"];
  submitted_by: ProjectPreview["submitted_by"];
  consent: {
    method: "owner-login-match";
    preview_version: string;
    confirmed_at: string;
  };
  summary: string;
  question: string;
  project_type: string;
  status: "pending";
  current_snapshot_id: string;
  request_id: string;
  created_at: string;
  updated_at: string;
}

interface SnapshotDocument {
  id: string;
  project_id: string;
  tool_id: string;
  kind: "project-snapshot";
  repository_commit: string;
  default_branch: string;
  prd: ProjectPreview["snapshot"]["prd"];
  checker_version: string;
  checked_at: string;
  fresh_until: string;
  limitations: string[];
}

interface ToolClaimDocument {
  id: string;
  project_id: string;
  tool_id: string;
  kind: "project-tool-claim";
  snapshot_id: string;
  claim: ProjectToolClaim;
}

function cleanText(raw: unknown, maxLength: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, maxLength) : "";
}

function isOversized(raw: unknown, maxLength: number): boolean {
  return typeof raw === "string" && raw.trim().length > maxLength;
}

async function parseBody<T>(
  req: Request,
): Promise<{ value: T | null; tooLarge: boolean }> {
  const declared = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_PROJECT_BODY_BYTES) {
    await req.body?.cancel();
    return { value: null, tooLarge: true };
  }
  if (!req.body) return { value: null, tooLarge: false };
  try {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROJECT_BODY_BYTES) {
        await reader.cancel();
        return { value: null, tooLarge: true };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    return { value: JSON.parse(text) as T, tooLarge: false };
  } catch {
    return { value: null, tooLarge: false };
  }
}

async function requireSession(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<AuthSession | Response> {
  const session = await getSession(req, env);
  return session ?? json({ error: "GitHub sign-in required." }, 401, cors);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashIp(env: Env, req: Request): Promise<string> {
  return sha256Hex(env.requestMetadata.clientIp(req));
}

async function releaseQuota(
  env: Env,
  rules: { key: string; limit: number }[],
): Promise<void> {
  try {
    await env.quota.release(rules);
  } catch (error) {
    console.error("Project quota release failed", error);
  }
}

function cleanConsistencyToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  return value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : "";
}

function parseTools(raw: unknown, allowedTools: Set<string>): ProjectToolInput[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) return null;
  const tools: ProjectToolInput[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const value = candidate as Record<string, unknown>;
    const toolId = cleanText(value.tool_id, 64).toLowerCase();
    const declaredUse = cleanText(value.declared_use, 300);
    const declaredInPrd = value.declared_in_prd;
    const stackPath = cleanText(value.stack_path, 160);
    if (!allowedTools.has(toolId) || typeof declaredInPrd !== "boolean") return null;
    tools.push({
      tool_id: toolId,
      declared_use: declaredUse,
      declared_in_prd: declaredInPrd,
      stack_path: stackPath,
    });
  }
  return tools;
}

function projectId(githubRepositoryId: number): string {
  return `github-repository:${githubRepositoryId}`;
}

async function snapshotId(
  project: string,
  snapshot: Omit<ProjectPreview["snapshot"], "id">,
  claims: ProjectToolClaim[],
): Promise<string> {
  const digest = await sha256Hex(JSON.stringify({ project, snapshot, claims }));
  return `snapshot:${project}:${digest}`;
}

function publicPendingProject(project: ProjectDocument) {
  return {
    id: project.id,
    repository: project.repository,
    submitted_by: project.submitted_by,
    consent: project.consent,
    summary: project.summary,
    question: project.question,
    project_type: project.project_type,
    status: project.status,
    current_snapshot_id: project.current_snapshot_id,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

export async function handleProjectPreview(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const parsed = await parseBody<ProjectPreviewInput>(req);
  if (parsed.tooLarge) {
    return json({ error: "request body exceeds the allowed size" }, 413, cors);
  }
  const body = parsed.value;
  if (
    isOversized(body?.repository_url, 300) ||
    isOversized(body?.prd_path, 240) ||
    isOversized(body?.summary, 500) ||
    isOversized(body?.question, 240) ||
    isOversized(body?.project_type, 64) ||
    isOversized(body?.approved_excerpt, 500)
  ) {
    return json({ error: "Project preview input exceeds the allowed length" }, 400, cors);
  }
  const repositoryUrl = cleanText(body?.repository_url, 300);
  const prdPath = cleanText(body?.prd_path, 240);
  const summary = cleanText(body?.summary, 500);
  const question = cleanText(body?.question, 240);
  const projectType = cleanText(body?.project_type, 64).toLowerCase();
  const approvedExcerpt = cleanText(body?.approved_excerpt, 500);
  const tools = parseTools(body?.tools, PROJECT_PILOT_TOOLS);

  if (!repositoryUrl || !prdPath || !tools) {
    return json({ error: "repository_url, prd_path, and 1-6 supported tools are required" }, 400, cors);
  }
  if (summary.length < 20 || question.length < 12 || !PROJECT_TYPES.has(projectType)) {
    return json({ error: "summary, question, or project_type is invalid" }, 400, cors);
  }

  const previewQuotaRules = [
    { key: `project:preview:user:${auth.user.id}`, limit: PREVIEWS_PER_USER_DAILY },
    { key: `project:preview:ip:${await hashIp(env, req)}`, limit: PREVIEWS_PER_IP_DAILY },
    { key: "project:preview:global", limit: PREVIEWS_GLOBAL_DAILY },
  ];
  const quota = await env.quota.reserve(previewQuotaRules);
  if (!quota.allowed) {
    return json({ error: "daily Project preview limit reached" }, 429, cors);
  }

  let inspection;
  try {
    inspection = await inspectProjectRepository(
      repositoryUrl,
      prdPath,
      approvedExcerpt,
      tools,
      auth.user.login,
      auth.user.id,
      env.GITHUB_REPOSITORY_TOKEN,
    );
  } catch (error) {
    await releaseQuota(env, previewQuotaRules);
    console.error("Project repository inspection failed", error);
    return json({ error: "Project repository inspection unavailable" }, 502, cors);
  }
  if (!inspection.ok) {
    if (inspection.status >= 500) {
      await releaseQuota(env, previewQuotaRules);
    }
    return json({ error: inspection.error }, inspection.status, cors);
  }

  const id = projectId(inspection.inspection.repository.github_id);
  const snapshot = inspection.inspection;
  const limitations = [
    "Repository consent is an owner-login match for this preview only.",
    "Declared uses and declared-in-PRD status are builder-authored, not deterministic observations.",
    "Matched files are literal dated observations, not production-use or quality proof.",
    "This preview creates no Project and invokes no model.",
  ];
  const snapshotWithoutId: Omit<ProjectPreview["snapshot"], "id"> = {
    repository_commit: snapshot.repository.commit_sha,
    default_branch: snapshot.repository.default_branch,
    prd: {
      ...snapshot.prd,
      approved_excerpt: approvedExcerpt || null,
    },
    checker_version: snapshot.checker_version,
    checked_at: snapshot.checked_at,
    fresh_until: snapshot.fresh_until,
    limitations,
  };
  const preview: ProjectPreview = {
    project_id: id,
    repository: snapshot.repository,
    submitted_by: {
      github_user_id: auth.user.id,
      login: auth.user.login,
    },
    summary,
    question,
    project_type: projectType,
    status: "preview",
    snapshot: {
      id: await snapshotId(id, snapshotWithoutId, snapshot.claims),
      ...snapshotWithoutId,
    },
    claims: snapshot.claims,
    limitations,
  };
  const previewVersion = `sha256:${await sha256Hex(JSON.stringify(preview))}`;
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString();
  const stored: StoredProjectPreview = {
    user_id: auth.user.id,
    expires_at: expiresAt,
    preview,
  };
  let consistencyToken: string;
  try {
    consistencyToken = await env.projectPreviews.put(
      previewVersion,
      JSON.stringify(stored),
      PREVIEW_TTL_SECONDS,
    );
  } catch (error) {
    await releaseQuota(env, previewQuotaRules);
    console.error("Project preview persistence failed", error);
    return json({ error: "Project preview could not be stored" }, 502, cors);
  }

  return json(
    {
      preview,
      preview_version: previewVersion,
      preview_consistency_token: consistencyToken,
      expires_at: expiresAt,
    },
    200,
    cors,
  );
}

export async function handleCreateProject(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const parsed = await parseBody<CreateProjectInput>(req);
  if (parsed.tooLarge) {
    return json({ error: "request body exceeds the allowed size" }, 413, cors);
  }
  const body = parsed.value;
  const requestedProjectId = cleanText(body?.project_id, 80).toLowerCase();
  const previewVersion = cleanText(body?.preview_version, 80).toLowerCase();
  const previewConsistencyToken = cleanConsistencyToken(
    body?.preview_consistency_token,
  );
  const requestId = cleanText(body?.request_id, 64).toLowerCase();
  if (
    body?.consent !== true ||
    !PROJECT_ID_PATTERN.test(requestedProjectId) ||
    !PREVIEW_VERSION_PATTERN.test(previewVersion) ||
    !previewConsistencyToken ||
    !REQUEST_ID_PATTERN.test(requestId)
  ) {
    return json(
      {
        error:
          "exact preview consent, project_id, preview_version, consistency token, and UUID request_id are required",
      },
      400,
      cors,
    );
  }

  const existing = await env.community.readDocument<ProjectDocument>(
    env.COSMOS_CONTAINER,
    requestedProjectId,
    requestedProjectId,
  );
  if (existing) {
    const sameRequest =
      existing.submitted_by.github_user_id === auth.user.id &&
      existing.consent.preview_version === previewVersion &&
      existing.request_id === requestId;
    if (!sameRequest) {
      return json({ error: "Project already exists for this repository" }, 409, cors);
    }
    return json({ project: publicPendingProject(existing) }, 200, cors);
  }

  let storedRaw: string | null;
  try {
    storedRaw = await env.projectPreviews.get(
      previewVersion,
      previewConsistencyToken,
    );
  } catch (error) {
    console.error("Project preview read failed", error);
    return json({ error: "Project preview could not be read" }, 502, cors);
  }
  let stored: StoredProjectPreview | null = null;
  try {
    stored = storedRaw ? (JSON.parse(storedRaw) as StoredProjectPreview) : null;
  } catch {
    stored = null;
  }
  if (
    !stored ||
    stored.user_id !== auth.user.id ||
    Date.parse(stored.expires_at) <= Date.now() ||
    stored.preview.project_id !== requestedProjectId
  ) {
    return json({ error: "Project preview is missing, expired, or belongs to another user" }, 409, cors);
  }

  const preview = stored.preview;
  const partition = requestedProjectId;

  const createQuotaRules = [
    { key: `project:create:user:${auth.user.id}`, limit: CREATES_PER_USER_DAILY },
    { key: `project:create:ip:${await hashIp(env, req)}`, limit: CREATES_PER_IP_DAILY },
    { key: "project:create:global", limit: CREATES_GLOBAL_DAILY },
  ];
  const quota = await env.quota.reserve(createQuotaRules);
  if (!quota.allowed) {
    return json({ error: "daily Project submission limit reached" }, 429, cors);
  }

  const now = new Date().toISOString();
  const snapshotDoc: SnapshotDocument = {
    id: preview.snapshot.id,
    project_id: partition,
    tool_id: partition,
    kind: "project-snapshot",
    repository_commit: preview.snapshot.repository_commit,
    default_branch: preview.snapshot.default_branch,
    prd: preview.snapshot.prd,
    checker_version: preview.snapshot.checker_version,
    checked_at: preview.snapshot.checked_at,
    fresh_until: preview.snapshot.fresh_until,
    limitations: preview.snapshot.limitations,
  };
  const claimDocs: ToolClaimDocument[] = preview.claims.map((claim) => ({
    id: `tool-claim:${preview.snapshot.id}:${claim.tool_id}`,
    project_id: partition,
    tool_id: partition,
    kind: "project-tool-claim",
    snapshot_id: preview.snapshot.id,
    claim,
  }));
  const pendingProject: ProjectDocument = {
    id: partition,
    project_id: partition,
    tool_id: partition,
    kind: "project",
    repository: preview.repository,
    submitted_by: preview.submitted_by,
    consent: {
      method: "owner-login-match",
      preview_version: previewVersion,
      confirmed_at: now,
    },
    summary: preview.summary,
    question: preview.question,
    project_type: preview.project_type,
    status: "pending",
    current_snapshot_id: preview.snapshot.id,
    request_id: requestId,
    created_at: now,
    updated_at: now,
  };

  try {
    await env.community.upsertDocument(
      env.COSMOS_CONTAINER,
      snapshotDoc,
      partition,
    );
    for (const claim of claimDocs) {
      await env.community.upsertDocument(env.COSMOS_CONTAINER, claim, partition);
    }
    await env.community.createDocument(
      env.COSMOS_CONTAINER,
      pendingProject,
      partition,
    );
    return json({ project: publicPendingProject(pendingProject) }, 201, cors);
  } catch (error) {
    await releaseQuota(env, createQuotaRules);
    let raced: ProjectDocument | null = null;
    try {
      raced = await env.community.readDocument<ProjectDocument>(
        env.COSMOS_CONTAINER,
        partition,
        partition,
      );
    } catch (readError) {
      console.error("Project idempotency read failed", readError);
    }
    if (
      raced?.submitted_by.github_user_id === auth.user.id &&
      raced.consent.preview_version === previewVersion &&
      raced.request_id === requestId
    ) {
      return json({ project: publicPendingProject(raced) }, 200, cors);
    }
    if (raced) {
      return json({ error: "Project already exists for this repository" }, 409, cors);
    }
    console.error("pending Project persistence failed", error);
    return json({ error: "Project could not enter pending review" }, 502, cors);
  }
}
