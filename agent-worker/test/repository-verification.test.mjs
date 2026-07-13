import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { verifyPublicRepository } from "../src/repository-verification.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("repository verification rejects private GitHub repositories", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.github.com/repos/curations/private-stack");
    assert.equal(init.headers.authorization, "Bearer read-only-token");
    return Response.json({ private: true, default_branch: "main" });
  };

  const result = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/private-stack",
    "",
    "",
    "curations",
    "read-only-token",
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "repository must be publicly readable",
  });
});

test("repository verification rejects inaccessible repositories that GitHub masks as 404", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://api.github.com/repos/curations/hidden-stack");
    return new Response("not found", { status: 404 });
  };

  const result = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/hidden-stack",
    "",
    "",
    "curations",
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "repository must be publicly readable",
  });
});

test("repository verification fails closed when visibility cannot be checked", async () => {
  globalThis.fetch = async () => {
    throw new Error("GitHub unavailable");
  };

  const result = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/public-stack",
    "",
    "",
    "curations",
  );

  assert.deepEqual(result, {
    ok: false,
    status: 502,
    error: "repository visibility could not be verified",
  });
});

test("repository verification detects supported stack markers", async () => {
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === "https://api.github.com/repos/curations/public-stack") {
      return Response.json({
        private: false,
        default_branch: "main",
        stargazers_count: 42,
        description: "A public stack",
        archived: false,
        fork: false,
      });
    }
    if (value.endsWith("/wrangler.toml")) {
      return new Response('name = "public-stack"\nmain = "src/index.ts"\n');
    }
    return new Response("not found", { status: 404 });
  };

  const result = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/public-stack",
    "https://github.com/curations/public-stack/blob/main/docs/PRD.md",
    "",
    "CURATIONS",
  );

  assert.equal(result.ok, true);
  assert.equal(result.prdUrl, "https://github.com/curations/public-stack/blob/main/docs/PRD.md");
  assert.equal(result.evidence.automated_status, "verified");
  assert.equal(result.evidence.submitter_matches_owner, true);
  assert.deepEqual(
    result.evidence.checks.filter((check) => check.matched).map((check) => check.path),
    ["wrangler.toml"],
  );
});

test("repository verification rejects traversal and cross-repository PRDs", async () => {
  const traversal = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/public-stack",
    "",
    "../private",
    "curations",
  );
  assert.equal(traversal.ok, false);
  assert.equal(traversal.error, "stack_path must be a relative directory inside the repository");

  const foreignPrd = await verifyPublicRepository(
    "cloudflare",
    "https://github.com/curations/public-stack",
    "https://github.com/other/repo/blob/main/PRD.md",
    "",
    "curations",
  );
  assert.equal(foreignPrd.ok, false);
  assert.equal(
    foreignPrd.error,
    "prd_url must be a public file inside the submitted GitHub repository",
  );
});
