/**
 * CURATIONS gateway router.
 *
 * The static Astro site talks only to this Worker. It owns GitHub identity,
 * Azure persona calls, rate limits, Cosmos writes, votes, and discussions.
 */

import {
  beginGithubAuth,
  endSession,
  finishGithubAuth,
  getSession,
  githubAuthConfigured,
} from "./auth";
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
} from "./community";
import type { Env } from "./env";
export { QuotaGuard } from "./quota";
export { VoteGuard } from "./vote-guard";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req.headers.get("origin") ?? "", env);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/api/auth/github/start" && req.method === "GET") {
      return beginGithubAuth(req, env);
    }
    if (url.pathname === "/api/auth/github/callback" && req.method === "GET") {
      return finishGithubAuth(req, env);
    }
    if (url.pathname === "/api/auth/config" && req.method === "GET") {
      return json({ github: githubAuthConfigured(env) }, 200, cors);
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
    if (url.pathname === "/api/health") {
      return json(
        {
          ok: true,
          identity: githubAuthConfigured(env) ? "github" : "github-unconfigured",
          storage: "cosmos-serverless",
          model: env.AZURE_OPENAI_DEPLOYMENT,
        },
        200,
        cors,
      );
    }
    return json({ error: "not found" }, 404, cors);
  },
} satisfies ExportedHandler<Env>;
