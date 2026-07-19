/**
 * Audit receipts (Lane D) — private receipt first, explicit publish.
 *
 * A repository owner submits the run-record their own GitHub Actions
 * produced (BYOC, Lane A). The receipt lands privately: only the owner can
 * see it. Publishing to the public display is a separate, explicit act —
 * and security-shaped findings are never publishable, only their count.
 *
 * Invariants honoured (PRD-project-evidence-registry §6, §11.4, §13):
 * - owner-only visibility by default; publication is opt-in per receipt;
 * - exact public preview: the owner sees the precise projection that would
 *   go public before consenting (invariant 8);
 * - revocable participation: the owner can withdraw at any time (invariant 9);
 * - Cosmos stores submitted state; Git stays authoritative for rules/schemas;
 * - mutating requests are quota-bound and size-limited.
 */

import { evaluateIntake } from "./audit-intake.ts";
import { badgeMarkdown } from "./audit-badges.ts";
import { getSession } from "./auth.ts";
import { json } from "./community.ts";
import type { Env } from "./env.ts";
import { verifyPublicRepository } from "./repository-verification.ts";

/** Failed findings at this severity are security-shaped: never published. */
export const SECURITY_SEVERITY = "fail";

const RECEIPTS_PER_DAY = 20;
const MAX_RECORD_BYTES = 64_000;
const DOC_TYPE = "audit-receipt";

export interface ReceiptFinding {
  check_id: string;
  artifact: string;
  confidence: number;
  passed: boolean;
  severity: string;
  detail: string;
}

export interface ReceiptRunRecord {
  run_id: string;
  findings: ReceiptFinding[];
  checks_passed: number;
  checks_total: number;
  ruleset_version: string;
  commit_sha: string;
  created_at: string;
  previous_run?: string | null;
  [extra: string]: unknown;
}

export interface AuditReceiptDoc {
  id: string;
  doc_type: typeof DOC_TYPE;
  /**
   * Carries the partition value. The production Cosmos container partitions
   * on /tool_id (infra/modules/foundry-integration.bicep); the Azure adapter
   * derives the write partition from the document BODY while point-reads
   * pass the partition argument explicitly — so this field must always equal
   * the partition argument (the document id) or reads miss the document
   * entirely. Found live in the 2026-07-19 stranger rehearsal:
   * "No receipt with that run_id" on publish after a successful store.
   */
  tool_id: string;
  owner_id: string;
  owner_login: string;
  repository: { owner: string; name: string };
  run_record: ReceiptRunRecord;
  published: boolean;
  published_at: string | null;
  revoked_at: string | null;
  public: PublicAuditRecord | null;
  created_at: string;
  updated_at: string;
}

/** The only shape that ever leaves the owner's view. */
export interface PublicAuditRecord {
  run_id: string;
  repository: { owner: string; name: string };
  commit_sha: string;
  ruleset_version: string;
  checks_passed: number;
  checks_total: number;
  record_created_at: string;
  published_at: string;
  /** Non-security checks only: identifier and pass/fail, nothing else. */
  checks: Array<{ check_id: string; passed: boolean }>;
  /** Failed security-shaped findings appear as a count — never as detail. */
  security_findings: number;
}

/**
 * Fail-closed structural validation. Anything unusable is rejected rather
 * than repaired — a receipt must mean exactly what the Actions run produced.
 */
export function validateRunRecord(candidate: unknown): candidate is ReceiptRunRecord {
  if (typeof candidate !== "object" || candidate === null) return false;
  const record = candidate as Record<string, unknown>;
  if (typeof record.run_id !== "string" || record.run_id.length === 0 || record.run_id.length > 64) {
    return false;
  }
  if (typeof record.commit_sha !== "string" || !/^[0-9a-f]{40}$/.test(record.commit_sha)) {
    return false;
  }
  if (
    !Number.isInteger(record.checks_passed) ||
    !Number.isInteger(record.checks_total) ||
    (record.checks_passed as number) < 0 ||
    (record.checks_total as number) <= 0 ||
    (record.checks_passed as number) > (record.checks_total as number)
  ) {
    return false;
  }
  if (typeof record.ruleset_version !== "string" || typeof record.created_at !== "string") {
    return false;
  }
  if (!Array.isArray(record.findings)) return false;
  for (const finding of record.findings) {
    if (typeof finding !== "object" || finding === null) return false;
    const entry = finding as Record<string, unknown>;
    if (
      typeof entry.check_id !== "string" ||
      typeof entry.passed !== "boolean" ||
      typeof entry.severity !== "string"
    ) {
      return false;
    }
  }
  return JSON.stringify(candidate).length <= MAX_RECORD_BYTES;
}

/**
 * The redaction rule — Lane D's falsifying proof target.
 *
 * Public projection carries counts, identity, and non-security check
 * outcomes as `{check_id, passed}` pairs only. Failed security-shaped
 * findings are collapsed into a count; their check ids, artifacts, details,
 * and confidences never appear.
 */
export function redactForPublic(
  doc: Pick<AuditReceiptDoc, "repository" | "run_record">,
  publishedAt: string,
): PublicAuditRecord {
  const record = doc.run_record;
  const securityFailures = record.findings.filter(
    (finding) => !finding.passed && finding.severity === SECURITY_SEVERITY,
  );
  const publishableChecks = record.findings
    .filter((finding) => finding.passed || finding.severity !== SECURITY_SEVERITY)
    .map((finding) => ({ check_id: finding.check_id, passed: finding.passed }));
  return {
    run_id: record.run_id,
    repository: { owner: doc.repository.owner, name: doc.repository.name },
    commit_sha: record.commit_sha,
    ruleset_version: record.ruleset_version,
    checks_passed: record.checks_passed,
    checks_total: record.checks_total,
    record_created_at: record.created_at,
    published_at: publishedAt,
    checks: publishableChecks,
    security_findings: securityFailures.length,
  };
}

function receiptId(runId: string): string {
  return `${DOC_TYPE}:${runId}`;
}

async function readOwnReceipt(
  env: Env,
  runId: string,
  ownerId: string,
): Promise<{ doc: AuditReceiptDoc | null; owned: boolean }> {
  const id = receiptId(runId);
  const doc = await env.community.readDocument<AuditReceiptDoc>(
    env.COSMOS_CONTAINER,
    id,
    id,
  );
  if (!doc || doc.doc_type !== DOC_TYPE) return { doc: null, owned: false };
  return { doc, owned: doc.owner_id === ownerId };
}

export async function handleReceiptSubmit(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  if (!session) {
    return json(
      { error: "Sign in with GitHub to store your audit receipt." },
      401,
      cors,
    );
  }

  let repositoryUrl = "";
  let runRecord: unknown = null;
  try {
    const body = (await req.json()) as {
      repository_url?: unknown;
      run_record?: unknown;
    };
    if (typeof body.repository_url === "string") {
      repositoryUrl = body.repository_url.trim();
    }
    runRecord = body.run_record ?? null;
  } catch {
    // shared refusal below
  }
  if (!repositoryUrl || runRecord === null) {
    return json(
      { error: "repository_url and run_record are both required." },
      400,
      cors,
    );
  }
  if (!validateRunRecord(runRecord)) {
    return json(
      {
        error:
          "run_record is not a usable Tier A record. Upload the unmodified " +
          "run-record.json artifact from your Actions run.",
      },
      400,
      cors,
    );
  }

  const verification = await verifyPublicRepository(
    "hygiene",
    repositoryUrl,
    "",
    "",
    session.user.login,
    env.GITHUB_REPOSITORY_TOKEN,
  );
  if (!verification.ok) {
    return json({ error: verification.error }, verification.status, cors);
  }
  const decision = evaluateIntake(verification.evidence, session.user.login);
  if (!decision.ok) {
    return json({ error: decision.reason }, decision.status, cors);
  }

  const quota = await env.quota.reserve([
    { key: `audit:receipt:${session.user.id}`, limit: RECEIPTS_PER_DAY },
  ]);
  if (!quota.allowed) {
    return json({ error: "Daily receipt limit reached. Try again tomorrow." }, 429, cors);
  }

  const now = new Date().toISOString();
  const id = receiptId(runRecord.run_id);
  const existing = await env.community.readDocument<AuditReceiptDoc>(
    env.COSMOS_CONTAINER,
    id,
    id,
  );
  if (existing && existing.owner_id !== session.user.id) {
    return json(
      { error: "A receipt with this run_id already belongs to another account." },
      409,
      cors,
    );
  }

  const doc: AuditReceiptDoc = {
    id,
    doc_type: DOC_TYPE,
    tool_id: id,
    owner_id: session.user.id,
    owner_login: session.user.login,
    repository: {
      owner: verification.evidence.owner,
      name: verification.evidence.name,
    },
    run_record: runRecord,
    published: existing?.published ?? false,
    published_at: existing?.published_at ?? null,
    revoked_at: existing?.revoked_at ?? null,
    public: existing?.public ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await env.community.upsertDocument(env.COSMOS_CONTAINER, doc, id);

  return json(
    {
      receipt: {
        run_id: runRecord.run_id,
        repository: doc.repository,
        published: doc.published,
      },
      public_preview: redactForPublic(doc, now),
      note:
        "Stored privately. Nothing is public until you explicitly publish, " +
        "and security-shaped findings are never published — only their count.",
    },
    200,
    cors,
  );
}

export async function handleReceiptList(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  if (!session) {
    return json({ error: "Sign in with GitHub to see your receipts." }, 401, cors);
  }
  const docs = await env.community.queryDocumentsCrossPartition<AuditReceiptDoc>(
    env.COSMOS_CONTAINER,
    "SELECT * FROM c WHERE c.doc_type = @type AND c.owner_id = @owner",
    [
      { name: "@type", value: DOC_TYPE },
      { name: "@owner", value: session.user.id },
    ],
  );
  const now = new Date().toISOString();
  const origin = new URL(req.url).origin;
  return json(
    {
      receipts: docs.map((doc) => {
        const badgeUrl = doc.published
          ? `${origin}/api/audit/badges/${doc.run_record.run_id}.svg`
          : null;
        return {
          run_id: doc.run_record.run_id,
          repository: doc.repository,
          run_record: doc.run_record,
          published: doc.published,
          published_at: doc.published_at,
          revoked_at: doc.revoked_at,
          public_preview: doc.public ?? redactForPublic(doc, now),
          badge_url: badgeUrl,
          badge_markdown:
            badgeUrl && doc.public
              ? badgeMarkdown({ ...doc.public, run_id: doc.run_record.run_id }, badgeUrl)
              : null,
          created_at: doc.created_at,
        };
      }),
    },
    200,
    cors,
  );
}

export async function handleReceiptPublish(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  if (!session) {
    return json({ error: "Sign in with GitHub to publish a receipt." }, 401, cors);
  }
  let runId = "";
  let confirmed = false;
  try {
    const body = (await req.json()) as { run_id?: unknown; confirm?: unknown };
    if (typeof body.run_id === "string") runId = body.run_id;
    confirmed = body.confirm === true;
  } catch {
    // shared refusal below
  }
  if (!runId) return json({ error: "run_id is required." }, 400, cors);
  if (!confirmed) {
    return json(
      {
        error:
          "Publishing is an explicit act. Send confirm: true after reviewing " +
          "the exact public preview.",
      },
      400,
      cors,
    );
  }

  const { doc, owned } = await readOwnReceipt(env, runId, session.user.id);
  if (!doc) return json({ error: "No receipt with that run_id." }, 404, cors);
  if (!owned) {
    return json(
      { error: "Only the receipt owner can publish it." },
      403,
      cors,
    );
  }

  const now = new Date().toISOString();
  const published: AuditReceiptDoc = {
    ...doc,
    published: true,
    published_at: now,
    revoked_at: null,
    public: redactForPublic(doc, now),
    updated_at: now,
  };
  await env.community.upsertDocument(env.COSMOS_CONTAINER, published, doc.id);
  const badgeUrl = `${new URL(req.url).origin}/api/audit/badges/${doc.run_record.run_id}.svg`;
  return json(
    {
      published: true,
      public_record: published.public,
      badge_url: badgeUrl,
      badge_markdown: badgeMarkdown(
        { ...published.public!, run_id: doc.run_record.run_id },
        badgeUrl,
      ),
    },
    200,
    cors,
  );
}

export async function handleReceiptRevoke(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const session = await getSession(req, env);
  if (!session) {
    return json({ error: "Sign in with GitHub to revoke a receipt." }, 401, cors);
  }
  let runId = "";
  try {
    const body = (await req.json()) as { run_id?: unknown };
    if (typeof body.run_id === "string") runId = body.run_id;
  } catch {
    // shared refusal below
  }
  if (!runId) return json({ error: "run_id is required." }, 400, cors);

  const { doc, owned } = await readOwnReceipt(env, runId, session.user.id);
  if (!doc) return json({ error: "No receipt with that run_id." }, 404, cors);
  if (!owned) {
    return json({ error: "Only the receipt owner can revoke it." }, 403, cors);
  }

  const now = new Date().toISOString();
  const revoked: AuditReceiptDoc = {
    ...doc,
    published: false,
    revoked_at: now,
    public: null,
    updated_at: now,
  };
  await env.community.upsertDocument(env.COSMOS_CONTAINER, revoked, doc.id);
  return json({ published: false, revoked_at: now }, 200, cors);
}

export async function handlePublicAuditRecords(
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const docs = await env.community.queryDocumentsCrossPartition<AuditReceiptDoc>(
    env.COSMOS_CONTAINER,
    "SELECT * FROM c WHERE c.doc_type = @type AND c.published = true",
    [{ name: "@type", value: DOC_TYPE }],
  );
  return json(
    {
      records: docs
        .filter((doc) => doc.public !== null)
        .map((doc) => doc.public),
    },
    200,
    cors,
  );
}
