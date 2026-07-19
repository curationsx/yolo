/**
 * Run-record loader — Lane B (plan/vibe-coding-v0.1-foundation.md).
 *
 * Reads the canonical self-audit run-records from docs/audits/run-records/
 * at build time. Real data only: if the directory is empty or a record is
 * structurally unusable, we render an honest empty state rather than a mock.
 *
 * Records conform to schemas/run-record.schema.json (run_record_schema 1.1.0).
 * The record intentionally carries no repo name — identity is the
 * repo_fingerprint. These records are the curationsx/yolo self-audits
 * (canonical integration test; see docs/audits/README provenance and PR #47),
 * so the display labels them as such.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface RunRecordFinding {
  check_id: string;
  artifact: string;
  confidence: number;
  passed: boolean;
  severity: string;
  detail: string;
}

export interface RunRecord {
  run_id: string;
  repo_fingerprint: string;
  findings: RunRecordFinding[];
  previous_run: string | null;
  created_at: string;
  wall_clock_seconds: number;
  files_inspected: number;
  checks_passed: number;
  checks_total: number;
  ruleset_version: string;
  commit_sha: string;
  script_versions: { hygiene: string; run_record_schema: string };
}

/** Repository the self-audit records attest to (provenance: docs/audits/). */
export const SELF_AUDIT_REPO = 'curationsx/yolo';

/** Fields the display depends on; records missing any are skipped, not faked. */
const REQUIRED_FIELDS: ReadonlyArray<keyof RunRecord> = [
  'run_id',
  'repo_fingerprint',
  'findings',
  'created_at',
  'checks_passed',
  'checks_total',
  'ruleset_version',
  'commit_sha',
];

function isUsable(candidate: Record<string, unknown>): candidate is RunRecord & Record<string, unknown> {
  return REQUIRED_FIELDS.every((field) => candidate[field] !== undefined);
}

/**
 * Load all run-records, newest first. `astro build`/`astro dev` run with
 * catalog-site/ as cwd; the records live at the repository root.
 */
export function loadRunRecords(): RunRecord[] {
  const dir = resolve(process.cwd(), '../docs/audits/run-records');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return []; // Directory absent → honest empty state.
  }

  const records: RunRecord[] = [];
  for (const file of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      if (isUsable(parsed)) records.push(parsed);
    } catch {
      // Malformed JSON never renders as truth; skip it.
    }
  }

  return records.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** "2026-07-18T10:24:09Z" → "2026-07-18 10:24 UTC" (deterministic, no locale). */
export function formatCreatedAt(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Count-form phrase — the only sanctioned quality claim in v0.1. */
export function countForm(record: RunRecord): string {
  return `Tier A: ${record.checks_passed}/${record.checks_total} · ${record.ruleset_version}`;
}
