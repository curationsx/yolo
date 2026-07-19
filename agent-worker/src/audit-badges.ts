/**
 * Receipt badges (gap G4) — count-form badges for published receipts.
 *
 * Strangers' published records live in the receipt store, not in the
 * repository, so their badges cannot be pre-committed like the self-audit
 * ones. This module renders them on demand — for PUBLISHED receipts only,
 * and only from the public projection (never the private run_record).
 *
 * The renderer is a line-faithful port of scripts/audit/badge.py
 * `render_svg`. Byte parity with the Python generator is asserted in
 * test/audit-badges.test.mjs against the committed artifacts in
 * docs/audits/badges/ — if the two implementations ever drift, that test
 * fails before anything ships.
 */

import type { PublicAuditRecord } from "./audit-receipts.ts";
import { json } from "./community.ts";
import type { Env } from "./env.ts";

// Palette and metrics mirror scripts/audit/badge.py (Visual Oracle tokens).
const INK = "#1a1614";
const PAPER = "#faf7f2";
const LIME = "#ebf998";
const MONO = "JetBrains Mono, IBM Plex Mono, ui-monospace, Courier New, monospace";

const CHAR_W = 7.3;
const PAD_X = 10;
const HEIGHT = 28;
const SHADOW = 3;
const BORDER = 2;

/** Public display the badge links back to (matches badge.py). */
export const DISPLAY_URL = "https://curations.dev/";

/**
 * Python's round(x, 1) on IEEE doubles: round to the nearest tenth with
 * ties-to-even — where "tie" means the double is EXACTLY halfway (e.g.
 * 84.75, which is binary-representable). Values like 163.15 usually are
 * not exact (163.1499…8) and must round by actual distance, not by their
 * decimal appearance. Both languages use IEEE doubles and this module
 * mirrors badge.py's arithmetic order, so exactness transfers.
 */
function pyRound1(value: number): number {
  const v100 = value * 100;
  if (Number.isInteger(v100) && Math.abs(v100 % 10) === 5) {
    const tenths = Math.floor(v100 / 10);
    return (tenths % 2 === 0 ? tenths : tenths + 1) / 10;
  }
  return Math.round(value * 10) / 10;
}

/** Python str(float): integral floats print with a trailing ".0". */
function pyFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

type BadgeInput = Pick<
  PublicAuditRecord,
  "checks_passed" | "checks_total" | "ruleset_version"
>;

/** Count-form phrase — identical to badge.py `count_form`. */
export function countForm(record: BadgeInput): string {
  return `Tier A: ${record.checks_passed}/${record.checks_total} · ${record.ruleset_version}`;
}

function segmentWidth(text: string): number {
  return pyRound1(text.length * CHAR_W + 2 * PAD_X);
}

/** Line-faithful port of badge.py `render_svg` — pure function of the record. */
export function renderBadgeSvg(record: BadgeInput): string {
  const label = "TIER A";
  const counts = `${record.checks_passed}/${record.checks_total}`;
  const ruleset = record.ruleset_version;
  const allPassed = record.checks_passed === record.checks_total;
  const countBg = allPassed ? LIME : PAPER;

  const labelW = segmentWidth(label);
  const countsW = segmentWidth(counts);
  const rulesetW = segmentWidth(ruleset);
  const width = pyRound1(labelW + countsW + rulesetW);
  const totalW = pyRound1(width + SHADOW);
  const totalH = HEIGHT + SHADOW;

  const textX = (offset: number, segmentW: number): number =>
    pyRound1(offset + segmentW / 2);
  const textY = HEIGHT / 2 + 4.5;

  const title = countForm(record);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pyFloat(totalW)}" height="${totalH}" role="img" aria-label="${title}">
  <title>${title}</title>
  <rect x="${SHADOW}" y="${SHADOW}" width="${pyFloat(width)}" height="${HEIGHT}" fill="${INK}"/>
  <rect x="0" y="0" width="${pyFloat(width)}" height="${HEIGHT}" fill="${PAPER}" stroke="${INK}" stroke-width="${BORDER}"/>
  <rect x="0" y="0" width="${pyFloat(labelW)}" height="${HEIGHT}" fill="${INK}"/>
  <rect x="${pyFloat(labelW)}" y="0" width="${pyFloat(countsW)}" height="${HEIGHT}" fill="${countBg}" stroke="${INK}" stroke-width="1"/>
  <g font-family="${MONO}" font-size="12" text-anchor="middle">
    <text x="${pyFloat(textX(0, labelW))}" y="${pyFloat(textY)}" fill="${PAPER}" font-weight="700">${label}</text>
    <text x="${pyFloat(textX(labelW, countsW))}" y="${pyFloat(textY)}" fill="${INK}" font-weight="700">${counts}</text>
    <text x="${pyFloat(textX(labelW + countsW, rulesetW))}" y="${pyFloat(textY)}" fill="${INK}">${ruleset}</text>
  </g>
</svg>
`;
}

/** README snippet for a published receipt's badge. */
export function badgeMarkdown(record: BadgeInput & { run_id: string }, badgeUrl: string): string {
  return `[![${countForm(record)}](${badgeUrl})](${DISPLAY_URL})`;
}

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/audit/badges/{run_id}.svg — public, published receipts only.
 * Unpublished and unknown receipts are indistinguishable (404) so the
 * badge endpoint cannot be used to probe private receipts.
 */
export async function handleReceiptBadge(
  runId: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!RUN_ID_PATTERN.test(runId)) {
    return json({ error: "No published badge for that run_id." }, 404, cors);
  }
  const id = `audit-receipt:${runId}`;
  const doc = await env.community.readDocument<{
    doc_type: string;
    published: boolean;
    public: PublicAuditRecord | null;
  }>(env.COSMOS_CONTAINER, id, id);
  if (!doc || doc.doc_type !== "audit-receipt" || !doc.published || !doc.public) {
    return json({ error: "No published badge for that run_id." }, 404, cors);
  }
  return new Response(renderBadgeSvg(doc.public), {
    status: 200,
    headers: {
      ...cors,
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
