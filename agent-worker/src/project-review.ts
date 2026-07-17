import { json } from "./community.ts";
import type { Env } from "./env.ts";
import {
  cleanProjectText,
  isProjectOversized,
  parseProjectBody,
  requireProjectSession,
  type ProjectDocument,
  type ProjectReviewEvent,
  type ProjectRevocationEvent,
  type ProjectStatus,
  type SnapshotDocument,
  type ToolClaimDocument,
} from "./projects.ts";

const PROJECT_ID_PATTERN = /^github-repository:[1-9][0-9]{0,19}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROUTE_PART_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const REVIEW_ACTIONS = new Set(["approve", "return", "reject", "hide", "restore"]);
const REVIEW_STATUSES = new Set<ProjectStatus>([
  "draft",
  "pending",
  "published",
  "stale",
  "revoked",
  "rejected",
]);
const REVIEW_ACTIONS_PER_USER_DAILY = 100;
const REVIEW_ACTIONS_PER_IP_DAILY = 150;
const REVOKES_PER_USER_DAILY = 20;
const REVOKES_PER_IP_DAILY = 40;
const MAX_TRANSITION_ATTEMPTS = 5;
const MAX_AUDIT_EVENTS = 100;
const PROJECT_ROUTE_DOC_ID = "project-route";

interface ReviewInput {
  project_id?: unknown;
  action?: unknown;
  reason?: unknown;
  request_id?: unknown;
}

interface RevokeInput {
  project_id?: unknown;
  reason?: unknown;
  request_id?: unknown;
}

interface ProjectRouteDocument {
  id: typeof PROJECT_ROUTE_DOC_ID;
  tool_id: string;
  kind: "project-route";
  route_key: string;
  project_id: string;
  updated_at: string;
}

function maintainerIds(env: Env): Set<string> {
  return new Set(
    env.PROJECT_MAINTAINER_GITHUB_IDS.split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value)),
  );
}

function isMaintainer(env: Env, userId: string): boolean {
  return maintainerIds(env).has(userId);
}

async function hashIp(env: Env, req: Request): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.requestMetadata.clientIp(req)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function releaseQuota(
  env: Env,
  rules: { key: string; limit: number }[],
): Promise<void> {
  try {
    await env.quota.release(rules);
  } catch (error) {
    console.error("Project state quota release failed", error);
  }
}

function maintainerProject(project: ProjectDocument) {
  return {
    id: project.id,
    repository: project.repository,
    submitted_by: project.submitted_by,
    consent: project.consent,
    summary: project.summary,
    question: project.question,
    project_type: project.project_type,
    status: project.status,
    visibility: project.visibility,
    current_snapshot_id: project.current_snapshot_id,
    review_history: project.review_history,
    revocation_history: project.revocation_history,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

function builderProject(project: ProjectDocument) {
  return {
    id: project.id,
    repository: project.repository,
    submitted_by: project.submitted_by,
    consent: project.consent,
    summary: project.summary,
    question: project.question,
    project_type: project.project_type,
    status: project.status,
    visibility: project.visibility,
    current_snapshot_id: project.current_snapshot_id,
    revocation_history: project.revocation_history.map((event) => ({
      reason: event.reason,
      created_at: event.created_at,
    })),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

async function ensureRouteIndex(
  env: Env,
  project: ProjectDocument,
): Promise<void> {
  const route: ProjectRouteDocument = {
    id: PROJECT_ROUTE_DOC_ID,
    tool_id: project.route_key,
    kind: "project-route",
    route_key: project.route_key,
    project_id: project.project_id,
    updated_at: project.updated_at,
  };
  await env.community.upsertDocument(
    env.COSMOS_CONTAINER,
    route,
    route.route_key,
  );
}

function reviewTransition(
  project: ProjectDocument,
  action: ProjectReviewEvent["action"],
): { status: ProjectStatus; visibility: "public" | "hidden" } | null {
  if (action === "approve" && project.status === "pending") {
    return { status: "published", visibility: "public" };
  }
  if (action === "return" && project.status === "pending") {
    return { status: "draft", visibility: "hidden" };
  }
  if (
    action === "reject" &&
    (project.status === "pending" || project.status === "draft")
  ) {
    return { status: "rejected", visibility: "hidden" };
  }
  if (
    action === "hide" &&
    (project.status === "published" || project.status === "stale") &&
    project.visibility === "public"
  ) {
    return { status: project.status, visibility: "hidden" };
  }
  if (
    action === "restore" &&
    (project.status === "published" || project.status === "stale") &&
    project.visibility === "hidden"
  ) {
    return { status: project.status, visibility: "public" };
  }
  return null;
}

export async function handleProjectReviewQueue(
  req: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireProjectSession(req, env, cors);
  if (auth instanceof Response) return auth;
  if (!isMaintainer(env, auth.user.id)) {
    return json({ error: "Project maintainer access required" }, 403, cors);
  }
  const status = cleanProjectText(url.searchParams.get("status"), 16) as ProjectStatus;
  if (!REVIEW_STATUSES.has(status)) {
    return json({ error: "valid Project status is required" }, 400, cors);
  }
  try {
    const projects = await env.community.queryDocumentsCrossPartition<ProjectDocument>(
      env.COSMOS_CONTAINER,
      "SELECT TOP 50 * FROM c WHERE c.kind = @kind AND c.status = @status ORDER BY c.updated_at ASC",
      [
        { name: "@kind", value: "project" },
        { name: "@status", value: status },
      ],
    );
    return json(
      { status, projects: projects.map(maintainerProject) },
      200,
      cors,
      { "cache-control": "no-store" },
    );
  } catch (error) {
    console.error("Project review queue failed", error);
    return json({ error: "Project review queue unavailable" }, 502, cors);
  }
}

export async function handleProjectReviewAction(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireProjectSession(req, env, cors);
  if (auth instanceof Response) return auth;
  if (!isMaintainer(env, auth.user.id)) {
    return json({ error: "Project maintainer access required" }, 403, cors);
  }
  const parsed = await parseProjectBody<ReviewInput>(req);
  if (parsed.tooLarge) {
    return json({ error: "request body exceeds the allowed size" }, 413, cors);
  }
  const body = parsed.value;
  if (
    isProjectOversized(body?.project_id, 80) ||
    isProjectOversized(body?.action, 16) ||
    isProjectOversized(body?.reason, 500) ||
    isProjectOversized(body?.request_id, 64)
  ) {
    return json({ error: "Project review input exceeds the allowed length" }, 400, cors);
  }
  const projectId = cleanProjectText(body?.project_id, 80).toLowerCase();
  const action = cleanProjectText(body?.action, 16) as ProjectReviewEvent["action"];
  const reason = cleanProjectText(body?.reason, 500);
  const requestId = cleanProjectText(body?.request_id, 64).toLowerCase();
  if (
    !PROJECT_ID_PATTERN.test(projectId) ||
    !REVIEW_ACTIONS.has(action) ||
    reason.length < 8 ||
    !REQUEST_ID_PATTERN.test(requestId)
  ) {
    return json(
      { error: "project_id, action, reason, and UUID request_id are required" },
      400,
      cors,
    );
  }

  const rules = [
    { key: `project:review:user:${auth.user.id}`, limit: REVIEW_ACTIONS_PER_USER_DAILY },
    { key: `project:review:ip:${await hashIp(env, req)}`, limit: REVIEW_ACTIONS_PER_IP_DAILY },
  ];
  const quota = await env.quota.reserve(rules);
  if (!quota.allowed) {
    return json({ error: "daily Project review limit reached" }, 429, cors);
  }
  try {
    for (let attempt = 0; attempt < MAX_TRANSITION_ATTEMPTS; attempt += 1) {
      const project = await env.community.readDocument<ProjectDocument>(
        env.COSMOS_CONTAINER,
        projectId,
        projectId,
      );
      if (!project) {
        await releaseQuota(env, rules);
        return json({ error: "Project not found" }, 404, cors);
      }
      const prior = project.review_history.find(
        (event) => event.request_id === requestId,
      );
      if (prior) {
        await releaseQuota(env, rules);
        if (prior.action !== action) {
          return json({ error: "request_id already used for another review action" }, 409, cors);
        }
        if (action === "approve" || action === "restore") {
          await ensureRouteIndex(env, project);
        }
        return json({ project: maintainerProject(project) }, 200, cors);
      }
      if (project.review_history.length >= MAX_AUDIT_EVENTS) {
        await releaseQuota(env, rules);
        return json({ error: "Project review history limit reached" }, 409, cors);
      }
      const transition = reviewTransition(project, action);
      if (!transition) {
        await releaseQuota(env, rules);
        return json({ error: `cannot ${action} Project in ${project.status} state` }, 409, cors);
      }
      if (!project._etag) {
        throw new Error("Project review requires a Cosmos ETag");
      }
      const now = new Date().toISOString();
      const event: ProjectReviewEvent = {
        request_id: requestId,
        action,
        reason,
        actor: {
          github_user_id: auth.user.id,
          login: auth.user.login,
        },
        created_at: now,
      };
      const updated: ProjectDocument = {
        ...project,
        _etag: undefined,
        ...transition,
        review_history: [...project.review_history, event],
        updated_at: now,
      };
      const replaced = await env.community.replaceDocument(
        env.COSMOS_CONTAINER,
        projectId,
        updated,
        projectId,
        project._etag,
      );
      if (!replaced) continue;
      if (action === "approve" || action === "restore") {
        await ensureRouteIndex(env, updated);
      }
      return json(
        {
          project: maintainerProject(updated),
          publication_note:
            action === "approve"
              ? "Maintainer approval permits publication but is not endorsement."
              : undefined,
        },
        200,
        cors,
      );
    }
    await releaseQuota(env, rules);
    return json({ error: "Project changed during review; retry" }, 409, cors);
  } catch (error) {
    await releaseQuota(env, rules);
    console.error("Project review action failed", error);
    return json({ error: "Project review action failed" }, 502, cors);
  }
}

export async function handlePublicProject(
  owner: string,
  repo: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!ROUTE_PART_PATTERN.test(owner) || !ROUTE_PART_PATTERN.test(repo)) {
    return json({ error: "Project not found" }, 404, cors);
  }
  const routeKey = `${owner}/${repo}`.toLowerCase();
  try {
    const route = await env.community.readDocument<ProjectRouteDocument>(
      env.COSMOS_CONTAINER,
      PROJECT_ROUTE_DOC_ID,
      routeKey,
    );
    if (!route) return json({ error: "Project not found" }, 404, cors);
    const project = await env.community.readDocument<ProjectDocument>(
      env.COSMOS_CONTAINER,
      route.project_id,
      route.project_id,
    );
    if (
      !project ||
      (project.status !== "published" && project.status !== "stale") ||
      project.visibility !== "public" ||
      project.route_key !== routeKey
    ) {
      return json({ error: "Project not found" }, 404, cors);
    }
    const snapshot = await env.community.readDocument<SnapshotDocument>(
      env.COSMOS_CONTAINER,
      project.current_snapshot_id,
      project.project_id,
    );
    if (!snapshot) {
      return json({ error: "Project evidence unavailable" }, 503, cors);
    }
    const claims = await env.community.queryDocuments<ToolClaimDocument>(
      env.COSMOS_CONTAINER,
      "SELECT * FROM c WHERE c.kind = @kind AND c.snapshot_id = @snapshot",
      [
        { name: "@kind", value: "project-tool-claim" },
        { name: "@snapshot", value: project.current_snapshot_id },
      ],
      project.project_id,
    );
    return json(
      {
        project: {
          id: project.id,
          repository: project.repository,
          submitted_by: project.submitted_by,
          consent: {
            method: project.consent.method,
            confirmed_at: project.consent.confirmed_at,
          },
          summary: project.summary,
          question: project.question,
          project_type: project.project_type,
          status: project.status,
          freshness:
            project.status === "stale" ||
            Date.parse(snapshot.fresh_until) <= Date.now()
              ? "stale"
              : "fresh",
          created_at: project.created_at,
          updated_at: project.updated_at,
        },
        snapshot: {
          id: snapshot.id,
          repository_commit: snapshot.repository_commit,
          default_branch: snapshot.default_branch,
          prd: snapshot.prd,
          checker_version: snapshot.checker_version,
          checked_at: snapshot.checked_at,
          fresh_until: snapshot.fresh_until,
          limitations: snapshot.limitations,
        },
        claims: claims.map((claim) => claim.claim),
        publication_note:
          "Maintainer approval permits publication but is not endorsement, quality verification, or proof of production use.",
      },
      200,
      cors,
      { "cache-control": "no-store" },
    );
  } catch (error) {
    console.error("public Project read failed", error);
    return json({ error: "Project unavailable" }, 502, cors);
  }
}

export async function handleRevokeProject(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await requireProjectSession(req, env, cors);
  if (auth instanceof Response) return auth;
  const parsed = await parseProjectBody<RevokeInput>(req);
  if (parsed.tooLarge) {
    return json({ error: "request body exceeds the allowed size" }, 413, cors);
  }
  const body = parsed.value;
  const projectId = cleanProjectText(body?.project_id, 80).toLowerCase();
  const reason = cleanProjectText(body?.reason, 500);
  const requestId = cleanProjectText(body?.request_id, 64).toLowerCase();
  if (
    !PROJECT_ID_PATTERN.test(projectId) ||
    reason.length < 8 ||
    !REQUEST_ID_PATTERN.test(requestId)
  ) {
    return json({ error: "project_id, reason, and UUID request_id are required" }, 400, cors);
  }
  const rules = [
    { key: `project:revoke:user:${auth.user.id}`, limit: REVOKES_PER_USER_DAILY },
    { key: `project:revoke:ip:${await hashIp(env, req)}`, limit: REVOKES_PER_IP_DAILY },
  ];
  const quota = await env.quota.reserve(rules);
  if (!quota.allowed) {
    return json({ error: "daily Project revoke limit reached" }, 429, cors);
  }
  try {
    for (let attempt = 0; attempt < MAX_TRANSITION_ATTEMPTS; attempt += 1) {
      const project = await env.community.readDocument<ProjectDocument>(
        env.COSMOS_CONTAINER,
        projectId,
        projectId,
      );
      if (!project) {
        await releaseQuota(env, rules);
        return json({ error: "Project not found" }, 404, cors);
      }
      const maintainer = isMaintainer(env, auth.user.id);
      if (
        project.submitted_by.github_user_id !== auth.user.id &&
        !maintainer
      ) {
        await releaseQuota(env, rules);
        return json({ error: "Project owner or maintainer access required" }, 403, cors);
      }
      const prior = project.revocation_history.find(
        (event) => event.request_id === requestId,
      );
      if (prior) {
        await releaseQuota(env, rules);
        return json(
          { project: maintainer ? maintainerProject(project) : builderProject(project) },
          200,
          cors,
        );
      }
      if (project.status === "rejected") {
        await releaseQuota(env, rules);
        return json({ error: "rejected Project cannot be revoked" }, 409, cors);
      }
      if (project.revocation_history.length >= MAX_AUDIT_EVENTS) {
        await releaseQuota(env, rules);
        return json({ error: "Project revocation history limit reached" }, 409, cors);
      }
      if (!project._etag) {
        throw new Error("Project revoke requires a Cosmos ETag");
      }
      const now = new Date().toISOString();
      const event: ProjectRevocationEvent = {
        request_id: requestId,
        reason,
        actor: {
          github_user_id: auth.user.id,
          login: auth.user.login,
        },
        created_at: now,
      };
      const updated: ProjectDocument = {
        ...project,
        _etag: undefined,
        status: "revoked",
        visibility: "hidden",
        revocation_history: [...project.revocation_history, event],
        updated_at: now,
      };
      const replaced = await env.community.replaceDocument(
        env.COSMOS_CONTAINER,
        projectId,
        updated,
        projectId,
        project._etag,
      );
      if (!replaced) continue;
      return json(
        { project: maintainer ? maintainerProject(updated) : builderProject(updated) },
        200,
        cors,
      );
    }
    await releaseQuota(env, rules);
    return json({ error: "Project changed during revoke; retry" }, 409, cors);
  } catch (error) {
    await releaseQuota(env, rules);
    console.error("Project revoke failed", error);
    return json({ error: "Project revoke failed" }, 502, cors);
  }
}
