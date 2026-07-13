import {
  createDocumentWithSession,
  deleteDocumentWithSession,
  queryDocumentsWithSession,
  readDocumentWithSession,
  type CosmosConfig,
  upsertDocument,
} from "./cosmos";
import type { Env } from "./env";
import {
  getStorageValuesInBatches,
  putStorageEntriesInBatches,
} from "./storage-batches";

interface VoteDoc {
  id: string;
  target_id: string;
  user_id: string;
  created_at: string;
}

interface VoteMutation {
  target_id: string;
  user_id: string;
  voted: boolean;
}

interface ViewerMutation {
  target_id: string;
  user_id: string;
  voted: boolean;
  legacy_votes: string[];
}

interface ViewerCheck {
  targets: string[];
  user_id: string;
  legacy_votes: string[];
}

const TARGET_PATTERN =
  /^(?:software:[a-z0-9]+(?:-[a-z0-9]+)*|(?:discussion|comment):[a-z0-9]+(?:-[a-z0-9]+)*:[0-9a-f-]{36})$/;

function cosmosConfig(env: Env, container: string): CosmosConfig {
  return {
    endpoint: env.COSMOS_ENDPOINT,
    key: env.COSMOS_KEY,
    database: env.COSMOS_DATABASE,
    container,
  };
}

export class VoteGuard {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  private enqueue(operation: () => Promise<Response>): Promise<Response> {
    const response = this.queue.then(operation);
    this.queue = response.then(
      () => undefined,
      () => undefined,
    );
    return response;
  }

  private async importLegacyVotes(targets: string[]): Promise<void> {
    if (await this.state.storage.get<boolean>("viewer:legacy-imported")) return;
    const entries = targets.map((target) => [`vote:${target}`, true] as const);
    await putStorageEntriesInBatches(entries, (batch) =>
      this.state.storage.put(batch),
    );
    await this.state.storage.put("viewer:legacy-imported", true);
  }

  private async viewerVotes(): Promise<string[]> {
    const stored = await this.state.storage.list<boolean>({ prefix: "vote:" });
    return [...stored.entries()]
      .filter(([, voted]) => voted === true)
      .map(([key]) => key.slice("vote:".length));
  }

  private async mirrorLegacyVotes(userId: string, targets: string[]): Promise<void> {
    await this.env.RATE.put(`user-votes:${userId}`, JSON.stringify(targets));
  }

  private async rememberCosmosSession(sessionToken: string | null): Promise<void> {
    if (sessionToken) await this.state.storage.put("cosmos:session", sessionToken);
  }

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;

    if (path === "/mutate") {
      let body: Partial<VoteMutation>;
      try {
        body = (await req.json()) as Partial<VoteMutation>;
      } catch {
        return Response.json({ error: "invalid vote mutation" }, { status: 400 });
      }
      if (
        !body.target_id ||
        !TARGET_PATTERN.test(body.target_id) ||
        !body.user_id ||
        !/^\d+$/.test(body.user_id) ||
        typeof body.voted !== "boolean"
      ) {
        return Response.json({ error: "invalid vote mutation" }, { status: 400 });
      }
      const mutation: VoteMutation = {
        target_id: body.target_id,
        user_id: body.user_id,
        voted: body.voted,
      };
      return this.enqueue(() => this.mutate(mutation));
    }

    if (path === "/viewer/set") {
      let body: Partial<ViewerMutation>;
      try {
        body = (await req.json()) as Partial<ViewerMutation>;
      } catch {
        return Response.json({ error: "invalid viewer mutation" }, { status: 400 });
      }
      if (
        !body.target_id ||
        !TARGET_PATTERN.test(body.target_id) ||
        !body.user_id ||
        !/^\d+$/.test(body.user_id) ||
        typeof body.voted !== "boolean" ||
        !Array.isArray(body.legacy_votes)
      ) {
        return Response.json({ error: "invalid viewer mutation" }, { status: 400 });
      }
      const legacyVotes = [
        ...new Set(
          body.legacy_votes.filter(
            (target): target is string =>
              typeof target === "string" && TARGET_PATTERN.test(target),
          ),
        ),
      ].slice(0, 5000);
      const mutation: ViewerMutation = {
        target_id: body.target_id,
        user_id: body.user_id,
        voted: body.voted,
        legacy_votes: legacyVotes,
      };
      return this.enqueue(async () => {
        await this.importLegacyVotes(mutation.legacy_votes);
        const key = `vote:${mutation.target_id}`;
        if (mutation.voted) await this.state.storage.put(key, true);
        else await this.state.storage.delete(key);
        const viewerVotes = await this.viewerVotes();
        await this.mirrorLegacyVotes(mutation.user_id, viewerVotes);
        return Response.json({ ok: true, viewer_votes: viewerVotes });
      });
    }

    if (path === "/viewer/check") {
      let body: Partial<ViewerCheck>;
      try {
        body = (await req.json()) as Partial<ViewerCheck>;
      } catch {
        return Response.json({ error: "invalid viewer targets" }, { status: 400 });
      }
      const targets = Array.isArray(body.targets)
        ? [...new Set(body.targets.filter((target): target is string => typeof target === "string"))]
        : [];
      const legacyVotes = Array.isArray(body.legacy_votes)
        ? [
            ...new Set(
              body.legacy_votes.filter(
                (target): target is string =>
                  typeof target === "string" && TARGET_PATTERN.test(target),
              ),
            ),
          ].slice(0, 5000)
        : [];
      if (
        !targets.length ||
        targets.length > 200 ||
        targets.some((target) => !TARGET_PATTERN.test(target)) ||
        !body.user_id ||
        !/^\d+$/.test(body.user_id)
      ) {
        return Response.json({ error: "invalid viewer targets" }, { status: 400 });
      }
      return this.enqueue(async () => {
        await this.importLegacyVotes(legacyVotes);
        const keys = targets.map((target) => `vote:${target}`);
        const stored = await getStorageValuesInBatches(keys, (batch) =>
          this.state.storage.get<boolean>(batch),
        );
        return Response.json({
          viewer_votes: targets.filter((target) => stored.get(`vote:${target}`) === true),
        });
      });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  }

  private async mutate(body: VoteMutation): Promise<Response> {
    const votes = cosmosConfig(this.env, this.env.COSMOS_VOTES_CONTAINER);
    const voteId = `github-${body.user_id}`;
    let sessionToken = await this.state.storage.get<string>("cosmos:session");
    const existingResult = await readDocumentWithSession<VoteDoc>(
      votes,
      voteId,
      body.target_id,
      sessionToken,
    );
    sessionToken = existingResult.sessionToken ?? sessionToken;
    await this.rememberCosmosSession(sessionToken ?? null);
    const existing = existingResult.value;

    if (body.voted && !existing) {
      const vote: VoteDoc = {
        id: voteId,
        target_id: body.target_id,
        user_id: body.user_id,
        created_at: new Date().toISOString(),
      };
      sessionToken =
        (await createDocumentWithSession(votes, vote, body.target_id, sessionToken)) ??
        sessionToken;
      await this.rememberCosmosSession(sessionToken ?? null);
    } else if (!body.voted && existing) {
      sessionToken =
        (await deleteDocumentWithSession(votes, voteId, body.target_id, sessionToken)) ??
        sessionToken;
      await this.rememberCosmosSession(sessionToken ?? null);
    }

    const countResult = await queryDocumentsWithSession<number>(
      votes,
      "SELECT VALUE COUNT(1) FROM c",
      [],
      body.target_id,
      sessionToken,
    );
    await this.rememberCosmosSession(countResult.sessionToken);
    const count = countResult.value[0] ?? 0;
    await upsertDocument(
      cosmosConfig(this.env, this.env.COSMOS_SCORES_CONTAINER),
      {
        id: body.target_id,
        scope: "global",
        target_id: body.target_id,
        count,
        updated_at: new Date().toISOString(),
      },
      "global",
    );
    return Response.json({ target_id: body.target_id, voted: body.voted, count });
  }
}

async function callGuard<T>(
  env: Env,
  name: string,
  path: string,
  body: unknown,
): Promise<T> {
  const id = env.VOTE_GUARD.idFromName(name);
  const response = await env.VOTE_GUARD.get(id).fetch(`https://votes.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`vote guard failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function setVote(
  env: Env,
  targetId: string,
  userId: string,
  voted: boolean,
): Promise<{ target_id: string; voted: boolean; count: number }> {
  const legacyVotes =
    (await env.RATE.get<string[]>(`user-votes:${userId}`, "json")) ?? [];
  const result = await callGuard<{ target_id: string; voted: boolean; count: number }>(
    env,
    `target:${targetId}`,
    "/mutate",
    { target_id: targetId, user_id: userId, voted },
  );
  await callGuard<{ ok: boolean; viewer_votes: string[] }>(env, `user:${userId}`, "/viewer/set", {
    target_id: targetId,
    user_id: userId,
    voted,
    legacy_votes: legacyVotes,
  });
  return result;
}

export async function getViewerVotes(
  env: Env,
  userId: string,
  targets: string[],
): Promise<string[]> {
  if (!targets.length) return [];
  const legacyVotes =
    (await env.RATE.get<string[]>(`user-votes:${userId}`, "json")) ?? [];
  const result = await callGuard<{ viewer_votes: string[] }>(
    env,
    `user:${userId}`,
    "/viewer/check",
    { targets, user_id: userId, legacy_votes: legacyVotes },
  );
  return result.viewer_votes;
}
