import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  AUDIT_WORKFLOW_PIN,
  callerWorkflow,
  evaluateIntake,
  handleAuditIntake,
} from "../src/audit-intake.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function evidence(overrides = {}) {
  return {
    url: "https://github.com/stranger/tool",
    owner: "stranger",
    name: "tool",
    description: null,
    default_branch: "main",
    stars: 1,
    archived: false,
    fork: false,
    stack_path: null,
    submitter_matches_owner: true,
    automated_status: "partial",
    checks: [],
    checked_at: "2026-07-18T00:00:00.000Z",
    note: "",
    ...overrides,
  };
}

// Falsifying proof (Lane A): a signed-in user attempting to submit a repo
// they do not control must be refused with a plain-language reason.
test("intake refuses a repository the signed-in user does not control", () => {
  const decision = evaluateIntake(
    evidence({ owner: "someone-else", submitter_matches_owner: false }),
    "stranger",
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 403);
  assert.match(decision.reason, /@stranger/);
  assert.match(decision.reason, /someone-else\/tool/);
  assert.match(decision.reason, /belongs to @someone-else/);
});

test("intake refuses archived repositories in plain language", () => {
  const decision = evaluateIntake(evidence({ archived: true }), "stranger");
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 400);
  assert.match(decision.reason, /archived/);
});

test("intake refuses forks in plain language", () => {
  const decision = evaluateIntake(evidence({ fork: true }), "stranger");
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 400);
  assert.match(decision.reason, /fork/);
  assert.match(decision.reason, /source repositories only/);
});

test("intake accepts an owner-matched active source repository", () => {
  assert.deepEqual(evaluateIntake(evidence(), "STRANGER"), { ok: true });
});

test("caller workflow pins both the reusable reference and audit_ref", () => {
  const yaml = callerWorkflow("stranger", "tool", "a".repeat(40));
  assert.match(
    yaml,
    new RegExp(
      `uses: curationsx/yolo/\\.github/workflows/hygiene-audit-reusable\\.yml@${AUDIT_WORKFLOW_PIN}`,
    ),
  );
  assert.match(yaml, new RegExp(`audit_ref: ${AUDIT_WORKFLOW_PIN}`));
  assert.match(yaml, /repo_url: https:\/\/github\.com\/stranger\/tool\.git/);
  // The audited SHA defaults to the pinned head but stays overridable for re-runs.
  assert.match(yaml, new RegExp(`default: "${"a".repeat(40)}"`));
  assert.match(yaml, /commit_sha: \$\{\{ inputs\.commit_sha \}\}/);
  // Re-runs can carry lineage for truthful deltas (gap G3).
  assert.match(yaml, /previous_run: \$\{\{ inputs\.previous_run \}\}/);
  // Never a mutable ref.
  assert.doesNotMatch(yaml, /@main/);
  // Deterministic: same input, same bytes.
  assert.equal(yaml, callerWorkflow("stranger", "tool", "a".repeat(40)));
});

test("handler refuses anonymous requests before touching GitHub", async () => {
  globalThis.fetch = async () => {
    throw new Error("network must not be called for anonymous intake");
  };
  const env = { RATE: { get: async () => null, delete: async () => { } } };
  const response = await handleAuditIntake(
    new Request("https://api.curations.dev/api/audit/intake", {
      method: "POST",
      body: JSON.stringify({ repository_url: "https://github.com/a/b" }),
    }),
    env,
    {},
  );
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /Sign in with GitHub/);
});

test("handler walks a controlled repository through to pinned instructions", async () => {
  const session = {
    user: { provider: "github", id: "1", login: "stranger" },
    created_at: "2026-07-18T00:00:00.000Z",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
  const sessionToken = "t".repeat(48);
  const env = {
    RATE: {
      get: async (key) =>
        key === `session:${sessionToken}` ? session : null,
      delete: async () => { },
    },
  };
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
    if (url === "https://api.github.com/repos/stranger/tool/commits/main") {
      return Response.json({ sha: "b".repeat(40) });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const response = await handleAuditIntake(
    new Request("https://api.curations.dev/api/audit/intake", {
      method: "POST",
      headers: { authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ repository_url: "https://github.com/stranger/tool" }),
    }),
    env,
    {},
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.commit_sha, "b".repeat(40));
  assert.equal(body.workflow_path, ".github/workflows/hygiene-audit.yml");
  assert.match(body.workflow_yaml, /Tier A hygiene audit/);
  assert.equal(body.audit_ref, AUDIT_WORKFLOW_PIN);
  assert.equal(body.next_steps.length, 4);
});
