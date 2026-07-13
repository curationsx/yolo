import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workerRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wrangler = join(workerRoot, "node_modules", ".bin", "wrangler");

function responseJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "x-ms-session-token": "local-session-token",
  });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
}

function partitionKey(request) {
  const raw = request.headers["x-ms-documentdb-partitionkey"];
  if (typeof raw !== "string") return "";
  const parsed = JSON.parse(raw);
  return String(parsed[0] ?? "");
}

function documentKey(container, partition, id) {
  return `${container}\n${partition}\n${id}`;
}

async function startFakeCosmos() {
  const documents = new Map();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const match = url.pathname.match(
      /^\/dbs\/[^/]+\/colls\/([^/]+)\/docs(?:\/([^/]+))?$/,
    );
    if (!match) {
      responseJson(response, 404, { error: "unknown fake Cosmos path" });
      return;
    }

    const container = decodeURIComponent(match[1]);
    const id = match[2] ? decodeURIComponent(match[2]) : null;
    const partition = partitionKey(request);

    if (request.method === "GET" && id) {
      const document = documents.get(documentKey(container, partition, id));
      responseJson(response, document ? 200 : 404, document ?? { error: "not found" });
      return;
    }

    if (request.method === "DELETE" && id) {
      documents.delete(documentKey(container, partition, id));
      responseJson(response, 204, {});
      return;
    }

    if (request.method !== "POST") {
      responseJson(response, 405, { error: "method not allowed" });
      return;
    }

    const body = await requestBody(request);
    const contentType = request.headers["content-type"] ?? "";
    if (contentType.includes("application/query+json")) {
      const all = [...documents.entries()]
        .filter(([key]) => key.startsWith(`${container}\n${partition}\n`))
        .map(([, document]) => document);
      const parameters = new Map(
        (body.parameters ?? []).map((parameter) => [
          parameter.name,
          parameter.value,
        ]),
      );

      if (body.query.includes("COUNT(1)")) {
        responseJson(response, 200, { Documents: [all.length] });
        return;
      }

      let selected = all;
      if (parameters.has("@tool")) {
        selected = selected.filter(
          (document) => document.tool_id === parameters.get("@tool"),
        );
      }
      if (parameters.has("@kind")) {
        selected = selected.filter(
          (document) => document.kind === parameters.get("@kind"),
        );
      }

      const targetIds = [...parameters.entries()]
        .filter(([name]) => name.startsWith("@target"))
        .map(([, value]) => value);
      if (targetIds.length) {
        selected = selected.filter((document) =>
          targetIds.includes(document.target_id),
        );
      }

      const threadIds = [...parameters.entries()]
        .filter(([name]) => name.startsWith("@thread"))
        .map(([, value]) => value);
      if (threadIds.length) {
        selected = selected.filter((document) =>
          threadIds.includes(document.thread_id),
        );
      }

      responseJson(response, 200, { Documents: selected });
      return;
    }

    documents.set(documentKey(container, partition, body.id), body);
    responseJson(response, 201, body);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    port: server.address().port,
  };
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function waitForWorker(worker) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Wrangler did not become ready:\n${output}`));
    }, 20_000);

    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready on")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    worker.stdout.on("data", onData);
    worker.stderr.on("data", onData);
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Wrangler exited before ready (${code}):\n${output}`));
    });
  });
}

async function stopProcess(child) {
  if (child.exitCode !== null || !child.pid) return;
  process.kill(child.pid, "SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

async function repeatRequests(count, concurrency, request) {
  const responses = [];
  for (let offset = 0; offset < count; offset += concurrency) {
    const batchSize = Math.min(concurrency, count - offset);
    responses.push(
      ...(await Promise.all(
        Array.from({ length: batchSize }, (_, index) =>
          request(offset + index),
        ),
      )),
    );
  }
  return responses;
}

test(
  "authenticated users can publish and keep one vote per target",
  { timeout: 60_000 },
  async (context) => {
    const stateDirectory = await mkdtemp(join(tmpdir(), "curations-worker-test-"));
    const fakeCosmos = await startFakeCosmos();
    const workerPort = await reservePort();
    let worker;

    context.after(async () => {
      if (worker) await stopProcess(worker);
      await new Promise((resolve, reject) =>
        fakeCosmos.server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(stateDirectory, { recursive: true, force: true });
    });

    const token = "T".repeat(48);
    const session = {
      user: {
        provider: "github",
        id: "123",
        login: "test-curator",
        name: "Test Curator",
        avatar_url: "https://avatars.example/test-curator",
        html_url: "https://github.com/test-curator",
      },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    const seed = spawnSync(
      wrangler,
      [
        "kv",
        "key",
        "put",
        `session:${token}`,
        JSON.stringify(session),
        "--binding",
        "RATE",
        "--local",
        "--persist-to",
        stateDirectory,
      ],
      { cwd: workerRoot, encoding: "utf8" },
    );
    assert.equal(seed.status, 0, `${seed.stdout}\n${seed.stderr}`);

    const variables = {
      AZURE_OPENAI_ENDPOINT: "https://azure.invalid",
      AZURE_OPENAI_DEPLOYMENT: "test-model",
      COSMOS_ENDPOINT: `http://127.0.0.1:${fakeCosmos.port}`,
      COSMOS_KEY: Buffer.from("local-test-key").toString("base64"),
      COSMOS_DATABASE: "curations",
      COSMOS_CONTAINER: "engagements",
      COSMOS_VOTES_CONTAINER: "votes",
      COSMOS_SCORES_CONTAINER: "scores",
      COSMOS_DISCUSSIONS_CONTAINER: "discussions",
      ALLOWED_ORIGINS: "http://localhost:4321",
      MAX_QUESTION_CHARS: "4000",
      MAX_OUTPUT_TOKENS: "512",
      PER_IP_DAILY_LIMIT: "10",
      GLOBAL_DAILY_LIMIT: "200",
      SOFTWARE_TARGETS: "cloudflare,supabase",
      VOTE_BACKEND: "kv",
    };
    const args = [
      "dev",
      "--local",
      "--port",
      String(workerPort),
      "--persist-to",
      stateDirectory,
    ];
    for (const [key, value] of Object.entries(variables)) {
      args.push("--var", `${key}:${value}`);
    }
    worker = spawn(wrangler, args, {
      cwd: workerRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForWorker(worker);

    const base = `http://127.0.0.1:${workerPort}`;
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "http://localhost:4321",
    };

    const invalidVotes = await repeatRequests(
      200,
      10,
      () =>
        fetch(`${base}/api/votes/set`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            target_id: "software:unknown",
            voted: true,
          }),
        }),
    );
    assert.equal(
      invalidVotes.every((response) => response.status === 404),
      true,
    );

    const vote = async (voted) => {
      const response = await fetch(`${base}/api/votes/set`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          target_id: "software:cloudflare",
          voted,
        }),
      });
      if (response.status !== 200) {
        throw new Error(`vote failed (${response.status}): ${await response.text()}`);
      }
      return response.json();
    };

    assert.deepEqual(await vote(true), {
      target_id: "software:cloudflare",
      voted: true,
      count: 1,
    });
    assert.deepEqual(await vote(true), {
      target_id: "software:cloudflare",
      voted: true,
      count: 1,
    });

    let summary = await fetch(
      `${base}/api/votes?targets=software%3Acloudflare`,
      { headers },
    ).then((response) => response.json());
    assert.equal(summary.counts["software:cloudflare"], 1);
    assert.deepEqual(summary.viewer_votes, ["software:cloudflare"]);

    assert.deepEqual(await vote(false), {
      target_id: "software:cloudflare",
      voted: false,
      count: 0,
    });
    summary = await fetch(
      `${base}/api/votes?targets=software%3Acloudflare`,
      { headers },
    ).then((response) => response.json());
    assert.equal(summary.counts["software:cloudflare"], 0);
    assert.deepEqual(summary.viewer_votes, []);

    const invalidDiscussions = await repeatRequests(
      8,
      8,
      () =>
        fetch(`${base}/api/discussions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            tool_id: "cloudflare",
            title: "Invalid repository proof",
            body: "This rejected request must not consume the publishing quota.",
            artifact_kind: "public-prd",
            repository_url: "not-a-url",
            invite_agent: false,
          }),
        }),
    );
    assert.equal(
      invalidDiscussions.every((response) => response.status === 400),
      true,
    );

    const createResponse = await fetch(`${base}/api/discussions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool_id: "cloudflare",
        title: "Authenticated local proof",
        body: "A deterministic local publishing check with no production writes.",
        tags: ["testing"],
        invite_agent: false,
      }),
    });
    if (createResponse.status !== 201) {
      throw new Error(
        `discussion create failed (${createResponse.status}): ${await createResponse.text()}`,
      );
    }
    const created = await createResponse.json();
    assert.equal(created.thread.author_login, "test-curator");
    assert.equal(created.thread.author_type, "human");
    assert.equal(created.agent_comment, null);

    const invalidComments = await repeatRequests(
      25,
      10,
      () =>
        fetch(`${base}/api/discussions/comment`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            tool_id: "cloudflare",
            thread_id: "00000000-0000-4000-8000-000000000000",
            body: "This missing-thread reply must not consume quota.",
            invite_agent: false,
          }),
        }),
    );
    assert.equal(
      invalidComments.every((response) => response.status === 404),
      true,
    );

    const commentResponse = await fetch(`${base}/api/discussions/comment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool_id: "cloudflare",
        thread_id: created.thread.id,
        body: "The valid reply still publishes after rejected attempts.",
        invite_agent: false,
      }),
    });
    if (commentResponse.status !== 201) {
      throw new Error(
        `comment create failed (${commentResponse.status}): ${await commentResponse.text()}`,
      );
    }
    const createdComment = await commentResponse.json();
    assert.equal(createdComment.comment.author_login, "test-curator");

    const discussions = await fetch(
      `${base}/api/discussions?tool=cloudflare`,
      { headers: { origin: "http://localhost:4321" } },
    ).then((response) => response.json());
    assert.equal(discussions.threads.length, 1);
    assert.equal(discussions.threads[0].title, "Authenticated local proof");
    assert.equal(discussions.threads[0].author_login, "test-curator");
    assert.equal(discussions.threads[0].comments.length, 1);
  },
);
