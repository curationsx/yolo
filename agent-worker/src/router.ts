/**
 * CURATIONS gateway router — the shared Fetch handler.
 *
 * This module only depends on the project-owned `Env` contract (`./env.ts`).
 * It never imports a Cloudflare or Azure SDK type, which is what lets the
 * same router run unmodified behind the Cloudflare Worker entrypoint
 * (`index.ts`) and the Node/Azure entrypoint
 * (`platform/azure/server.ts`).
 */

import {
  beginCopilotGithubAuth,
  beginGithubAuth,
  copilotAuthConfigured,
  endSession,
  finishGithubAuth,
  getSession,
  githubAuthConfigured,
  issueCopilotAuthorization,
} from "./auth.ts";
import {
  handleCopilotDisconnect,
  handleCopilotRun,
  handleCopilotStatus,
} from "./copilot.ts";
import {
  corsHeaders,
  handleAsk,
  handleCreateComment,
  handleCreateDiscussion,
  handleDiscussions,
  handleFeed,
  handleVotes,
  handleVoteSet,
  handleVoteToggle,
  json,
} from "./community.ts";
import type { Env } from "./env.ts";
import {
  handleCreateProject,
  handleProjectPreview,
} from "./projects.ts";
import {
  handleProjectReviewAction,
  handleProjectReviewQueue,
  handlePublicProject,
  handleRevokeProject,
} from "./project-review.ts";

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const cors = corsHeaders(req.headers.get("origin") ?? "", env);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (url.pathname === "/api/live" && req.method === "GET") {
    return json({ ok: true }, 200, cors);
  }
  if (url.pathname === "/api/ready" && req.method === "GET") {
    const result = await env.readiness.check();
    return json(result, result.ready ? 200 : 503, cors);
  }

  if (url.pathname === "/api/auth/github/start" && req.method === "GET") {
    return beginGithubAuth(req, env);
  }
  if (url.pathname === "/api/auth/github/callback" && req.method === "GET") {
    return finishGithubAuth(req, env);
  }
  if (url.pathname === "/api/auth/config" && req.method === "GET") {
    return json(
      {
        github: githubAuthConfigured(env),
        copilot: copilotAuthConfigured(env),
      },
      200,
      cors,
    );
  }
  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const session = await getSession(req, env);
    return session
      ? json({ user: session.user, expires_at: session.expires_at }, 200, cors)
      : json({ user: null }, 401, cors);
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    await endSession(req, env);
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname === "/api/copilot/connect" && req.method === "POST") {
    const result = await issueCopilotAuthorization(req, env);
    return result.ok
      ? json({ authorize_url: result.authorize_url }, 200, cors)
      : json({ error: result.error }, result.status, cors);
  }
  if (url.pathname === "/api/copilot/github/start" && req.method === "GET") {
    return beginCopilotGithubAuth(req, env);
  }
  if (url.pathname === "/api/copilot/status" && req.method === "GET") {
    return handleCopilotStatus(req, env, cors);
  }
  if (url.pathname === "/api/copilot/disconnect" && req.method === "POST") {
    return handleCopilotDisconnect(req, env, cors);
  }
  if (url.pathname === "/api/copilot/run" && req.method === "POST") {
    return handleCopilotRun(req, env, cors);
  }

  if (url.pathname === "/api/ask" && req.method === "POST") {
    return handleAsk(req, env, cors);
  }
  if (url.pathname === "/api/feed" && req.method === "GET") {
    return handleFeed(url, env, cors);
  }
  if (url.pathname === "/api/votes" && req.method === "GET") {
    return handleVotes(req, url, env, cors);
  }
  if (url.pathname === "/api/votes/set" && req.method === "POST") {
    return handleVoteSet(req, env, cors);
  }
  if (url.pathname === "/api/votes/toggle" && req.method === "POST") {
    return handleVoteToggle(req, env, cors);
  }
  if (url.pathname === "/api/discussions" && req.method === "GET") {
    return handleDiscussions(req, url, env, cors);
  }
  if (url.pathname === "/api/discussions" && req.method === "POST") {
    return handleCreateDiscussion(req, env, cors);
  }
  if (url.pathname === "/api/discussions/comment" && req.method === "POST") {
    return handleCreateComment(req, env, cors);
  }
  if (url.pathname === "/api/projects/preview" && req.method === "POST") {
    return handleProjectPreview(req, env, cors);
  }
  if (url.pathname === "/api/projects" && req.method === "POST") {
    return handleCreateProject(req, env, cors);
  }
  if (url.pathname === "/api/projects/review" && req.method === "GET") {
    return handleProjectReviewQueue(req, url, env, cors);
  }
  if (url.pathname === "/api/projects/review" && req.method === "POST") {
    return handleProjectReviewAction(req, env, cors);
  }
  if (url.pathname === "/api/projects/revoke" && req.method === "POST") {
    return handleRevokeProject(req, env, cors);
  }
  const projectRoute = url.pathname.match(
    /^\/api\/projects\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
  );
  if (projectRoute && req.method === "GET") {
    return handlePublicProject(projectRoute[1], projectRoute[2], env, cors);
  }
  if (url.pathname === "/api/health") {
    return json(
      {
        ok: true,
        identity: githubAuthConfigured(env) ? "github" : "github-unconfigured",
        copilot: copilotAuthConfigured(env) ? "user-funded" : "unconfigured",
        storage: "cosmos-serverless",
        model: env.AZURE_OPENAI_DEPLOYMENT,
      },
      200,
      cors,
    );
  }
  return json({ error: "not found" }, 404, cors);
}
