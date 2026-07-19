import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  handlePublicAuditRecords,
  handleReceiptList,
  handleReceiptPublish,
  handleReceiptRevoke,
  handleReceiptSubmit,
  redactForPublic,
  validateRunRecord,
} from "../src/audit-receipts.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const SESSION_TOKEN = "t".repeat(48);
const OTHER_TOKEN = "u".repeat(48);

function makeEnv() {
  const docs = new Map();
  const sessions = {
    [`session:${SESSION_TOKEN}`]: {
      user: { provider: "github", id: "1", login: "stranger" },
      created_at: "2026-07-18T00:00:00.000Z",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
    [`session:${OTHER_TOKEN}`]: {
      user: { provider: "github", id: "2", login: "rival" },
      created_at: "2026-07-18T00:00:00.000Z",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  };
  return {
    COSMOS_CONTAINER: "c",
    RATE: {
      get: async (key) => sessions[key] ?? null,
      delete: async () => {},
    },
    quota: { reserve: async () => ({ allowed: true }) },
    community: {
      readDocument: async (_c, id) => docs.get(id) ?? null,
      upsertDocument: async (_c, doc) => {
        docs.set(doc.id, doc);
        return doc;
      },
      queryDocumentsCrossPartition: async (_c, query, params) => {
        const owner = params.find((p) => p.name === "@owner")?.value;
        const all = [...docs.values()].filter((d) => d.doc_type === "audit-receipt");
        if (query.includes("c.published = true")) {
          return all.filter((d) => d.published === true);
        }
        return all.filter((d) => d.owner_id === owner);
      },
    },
  };
}

function seededRunRecord() {
  return {
    run_id: "11111111-2222-4333-8444-555555555555",
    findings: [
      {
        check_id: "sensitive_filenames",
        artifact: "config/secrets.env",
        confidence: 1,
        passed: false,
        severity: "fail",
        detail: "candidate secret file config/secrets.env committed at repo root",
      },
      {
        check_id: "readme_nontrivial",
        artifact: "README.md",
        confidence: 1,
        passed: false,
        severity: "warn",
        detail: "README is 12 words",
      },
      {
        check_id: "licence_present",
        artifact: "LICENSE",
        confidence: 1,
        passed: true,
        severity: "info",
        detail: "Licence file present",
      },
    ],
    checks_passed: 1,
    checks_total: 3,
    ruleset_version: "hygiene/0.1.0",
    commit_sha: "a".repeat(40),
    created_at: "2026-07-18T12:00:00.000Z",
    previous_run: null,
  };
}

function mockGithub() {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.github.com/repos/stranger/tool") {
      return Response.json({
        private: false,
        default_branch: "main",
        archived: false,
        fork: false,
        description: null,
        stargazers_count: 1,
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

function submitRequest(token = SESSION_TOKEN, record = seededRunRecord()) {
  return new Request("https://api.curations.dev/api/audit/receipts", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      repository_url: "https://github.com/stranger/tool",
      run_record: record,
    }),
  });
}

// ---------------------------------------------------------------------------
// Falsifying proof (Lane D): a seeded security finding must appear publicly
// only as a count while its detail remains owner-visible.
// ---------------------------------------------------------------------------
test("published record shows security findings as count only; owner keeps detail", async () => {
  const env = makeEnv();
  mockGithub();

  const submit = await handleReceiptSubmit(submitRequest(), env, {});
  assert.equal(submit.status, 200);

  const publish = await handleReceiptPublish(
    new Request("https://api.curations.dev/api/audit/receipts/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
      body: JSON.stringify({
        run_id: "11111111-2222-4333-8444-555555555555",
        confirm: true,
      }),
    }),
    env,
    {},
  );
  assert.equal(publish.status, 200);
  const { public_record } = await publish.json();
  const publicJson = JSON.stringify(public_record);

  // Detail never leaks to any public surface.
  assert.ok(!publicJson.includes("secrets.env"), "artifact path leaked");
  assert.ok(!publicJson.includes("candidate secret"), "detail text leaked");
  assert.ok(!publicJson.includes('"artifact"'), "artifact key leaked");
  assert.ok(!publicJson.includes('"detail"'), "detail key leaked");
  assert.ok(!publicJson.includes("sensitive_filenames"), "security check id leaked");
  // The count is the only public trace.
  assert.equal(public_record.security_findings, 1);
  // Non-security failures stay truthful (id + status, nothing else).
  assert.deepEqual(
    public_record.checks.find((c) => c.check_id === "readme_nontrivial"),
    { check_id: "readme_nontrivial", passed: false },
  );

  // The public listing endpoint serves the same redacted projection.
  const records = await handlePublicAuditRecords(env, {});
  const listing = JSON.stringify(await records.json());
  assert.ok(!listing.includes("secrets.env"));
  assert.ok(listing.includes("readme_nontrivial"));

  // The owner's private view still carries the full finding.
  const list = await handleReceiptList(
    new Request("https://api.curations.dev/api/audit/receipts", {
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    }),
    env,
    {},
  );
  const { receipts } = await list.json();
  const finding = receipts[0].run_record.findings.find(
    (f) => f.check_id === "sensitive_filenames",
  );
  assert.equal(finding.artifact, "config/secrets.env");
  assert.match(finding.detail, /candidate secret file/);
});

test("redaction is pure and complete for the exact preview", () => {
  const doc = {
    repository: { owner: "stranger", name: "tool" },
    run_record: seededRunRecord(),
  };
  const projection = redactForPublic(doc, "2026-07-18T13:00:00.000Z");
  assert.equal(projection.security_findings, 1);
  assert.equal(projection.checks.length, 2);
  assert.ok(!projection.checks.some((c) => c.check_id === "sensitive_filenames"));
  // Same input, same projection (deterministic preview).
  assert.deepEqual(projection, redactForPublic(doc, "2026-07-18T13:00:00.000Z"));
});

test("publishing without explicit confirmation is refused", async () => {
  const env = makeEnv();
  mockGithub();
  await handleReceiptSubmit(submitRequest(), env, {});
  const publish = await handleReceiptPublish(
    new Request("https://api.curations.dev/api/audit/receipts/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
      body: JSON.stringify({ run_id: "11111111-2222-4333-8444-555555555555" }),
    }),
    env,
    {},
  );
  assert.equal(publish.status, 400);
  const body = await publish.json();
  assert.match(body.error, /explicit act/);
});

test("only the owner can publish or revoke", async () => {
  const env = makeEnv();
  mockGithub();
  await handleReceiptSubmit(submitRequest(), env, {});
  const publish = await handleReceiptPublish(
    new Request("https://api.curations.dev/api/audit/receipts/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${OTHER_TOKEN}` },
      body: JSON.stringify({
        run_id: "11111111-2222-4333-8444-555555555555",
        confirm: true,
      }),
    }),
    env,
    {},
  );
  assert.equal(publish.status, 403);
  const revoke = await handleReceiptRevoke(
    new Request("https://api.curations.dev/api/audit/receipts/revoke", {
      method: "POST",
      headers: { authorization: `Bearer ${OTHER_TOKEN}` },
      body: JSON.stringify({ run_id: "11111111-2222-4333-8444-555555555555" }),
    }),
    env,
    {},
  );
  assert.equal(revoke.status, 403);
});

test("revocation withdraws the public record entirely", async () => {
  const env = makeEnv();
  mockGithub();
  await handleReceiptSubmit(submitRequest(), env, {});
  const publishBody = JSON.stringify({
    run_id: "11111111-2222-4333-8444-555555555555",
    confirm: true,
  });
  await handleReceiptPublish(
    new Request("https://api.curations.dev/api/audit/receipts/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
      body: publishBody,
    }),
    env,
    {},
  );
  const revoke = await handleReceiptRevoke(
    new Request("https://api.curations.dev/api/audit/receipts/revoke", {
      method: "POST",
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
      body: JSON.stringify({ run_id: "11111111-2222-4333-8444-555555555555" }),
    }),
    env,
    {},
  );
  assert.equal(revoke.status, 200);
  const records = await handlePublicAuditRecords(env, {});
  const { records: list } = await records.json();
  assert.equal(list.length, 0);
});

test("validateRunRecord fails closed on malformed records", () => {
  const good = seededRunRecord();
  assert.equal(validateRunRecord(good), true);
  assert.equal(validateRunRecord({ ...good, commit_sha: "short" }), false);
  assert.equal(validateRunRecord({ ...good, checks_passed: 1.5 }), false);
  assert.equal(validateRunRecord({ ...good, checks_passed: 9 }), false);
  assert.equal(validateRunRecord({ ...good, findings: "none" }), false);
  assert.equal(
    validateRunRecord({ ...good, findings: [{ check_id: 1, passed: true, severity: "info" }] }),
    false,
  );
  assert.equal(validateRunRecord(null), false);
});

test("anonymous receipt submission is refused", async () => {
  const env = makeEnv();
  const response = await handleReceiptSubmit(
    new Request("https://api.curations.dev/api/audit/receipts", {
      method: "POST",
      body: JSON.stringify({}),
    }),
    env,
    {},
  );
  assert.equal(response.status, 401);
});

test("unpublished receipts never appear in the public listing", async () => {
  const env = makeEnv();
  mockGithub();
  await handleReceiptSubmit(submitRequest(), env, {});
  const records = await handlePublicAuditRecords(env, {});
  const { records: list } = await records.json();
  assert.equal(list.length, 0);
});
