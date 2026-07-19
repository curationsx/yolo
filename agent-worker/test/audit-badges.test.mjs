import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  badgeMarkdown,
  countForm,
  handleReceiptBadge,
  renderBadgeSvg,
} from "../src/audit-badges.ts";

const ROOT = resolve(import.meta.dirname, "../..");

function record(name) {
  return JSON.parse(
    readFileSync(resolve(ROOT, "docs/audits/run-records", name), "utf-8"),
  );
}

function committedBadge(runId) {
  return readFileSync(resolve(ROOT, "docs/audits/badges", `${runId}.svg`), "utf-8");
}

// ---------------------------------------------------------------------------
// Falsifying proof (G4): the worker renderer must be byte-identical to the
// Python generator for every committed artifact. Any drift between the two
// implementations fails here before it can ship.
// ---------------------------------------------------------------------------
test("worker badge render is byte-identical to badge.py output for all committed records", () => {
  for (const name of ["run-1.json", "run-2.json", "run-3.json"]) {
    const rec = record(name);
    assert.equal(
      renderBadgeSvg(rec),
      committedBadge(rec.run_id),
      `byte drift for ${name}`,
    );
  }
});

test("partial pass renders paper fill, full pass renders lime", () => {
  const rec = record("run-3.json");
  assert.ok(renderBadgeSvg(rec).includes("#ebf998"));
  const partial = { ...rec, checks_passed: 5 };
  assert.ok(!renderBadgeSvg(partial).includes("#ebf998"));
});

test("badge markdown links the badge to the public display", () => {
  const rec = record("run-3.json");
  const url = `https://api.curations.dev/api/audit/badges/${rec.run_id}.svg`;
  const snippet = badgeMarkdown({ ...rec, run_id: rec.run_id }, url);
  assert.equal(
    snippet,
    `[![${countForm(rec)}](${url})](https://curations.dev/)`,
  );
});

function makeEnv(doc) {
  return {
    COSMOS_CONTAINER: "c",
    community: {
      readDocument: async (_c, id) =>
        doc && id === `audit-receipt:${doc.run_id}` ? doc.stored : null,
    },
  };
}

const RUN_ID = "11111111-2222-4333-8444-555555555555";

function publishedDoc() {
  return {
    run_id: RUN_ID,
    stored: {
      doc_type: "audit-receipt",
      published: true,
      public: {
        run_id: RUN_ID,
        repository: { owner: "stranger", name: "tool" },
        commit_sha: "a".repeat(40),
        ruleset_version: "hygiene/0.1.0",
        checks_passed: 3,
        checks_total: 7,
        record_created_at: "2026-07-18T12:00:00.000Z",
        published_at: "2026-07-18T13:00:00.000Z",
        checks: [],
        security_findings: 1,
      },
    },
  };
}

test("published receipt badge is served as SVG with cache headers", async () => {
  const response = await handleReceiptBadge(RUN_ID, makeEnv(publishedDoc()), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(response.headers.get("cache-control"), /max-age=300/);
  const svg = await response.text();
  assert.ok(svg.includes("Tier A: 3/7 · hygiene/0.1.0"));
  assert.ok(!svg.includes("#ebf998"), "partial pass must not celebrate");
});

test("unpublished and unknown receipts are indistinguishable 404s", async () => {
  const doc = publishedDoc();
  doc.stored.published = false;
  doc.stored.public = null;
  const unpublished = await handleReceiptBadge(RUN_ID, makeEnv(doc), {});
  const unknown = await handleReceiptBadge(RUN_ID, makeEnv(null), {});
  assert.equal(unpublished.status, 404);
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unpublished.json(), await unknown.json());
});

test("malformed run ids are refused without a store lookup", async () => {
  const env = {
    COSMOS_CONTAINER: "c",
    community: {
      readDocument: async () => {
        throw new Error("store must not be queried for malformed ids");
      },
    },
  };
  const response = await handleReceiptBadge("../../etc/passwd", env, {});
  assert.equal(response.status, 404);
});
