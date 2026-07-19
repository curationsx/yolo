---
status: gold
category: assessment
title: "Answers to the 2026-07-19 maturity assessment — with shipped evidence"
created: 2026-07-19
relates_to:
  - vibe/01-gold/collaboration-memory/2026-07-19-maturity-assessment.md
  - docs/audits/2026-07-18-stranger-gate-rehearsal.md
  - docs/audits/cohort-ledger.json
owner: CurationsLA
---

# Answers to the maturity assessment — 2026-07-19

The assessment (authored independently by the GitHub Copilot coding agent)
posed eight questions as the "smallest set" blocking tier placement. Most
were answered by work that shipped the same day. Each answer cites its
evidence; none relies on intention.

## The eight questions, answered

**1. Deployment status of G1/G2 — merged and deployed?**
**Yes, both.** The lane stack (#54–#59), gap fixes (#60–#62), Board
restoration (#65), and wiki (#66) are merged. Azure production deploy run
`29677677471` succeeded end-to-end (gateway image + site, cloud acceptance
included). Verified live: `api.curations.dev/api/audit/records` answers;
`curations.dev` serves the Board with community tabs; `/records/`,
`/submit/project/`, `/receipts/` all 200.

**2. Badge hosting (G4) — is `/api/audit/badges/{run_id}.svg` serving?**
**The route is live** on the production gateway (merged in #61, deployed with
the same SHA). No stranger receipt has been *published* yet, so the endpoint
currently returns its designed 404 for every id — indistinguishable for
unpublished vs unknown, which is the privacy property working. The committed
self-audit badges serve statically from `/badges/`.

**3. Ducky rules revision history — any rule-hit that led to a rule change?**
**Two revisions, one of them a learning step.** #52 hardened the plumbing
(no rule change). The Phase A amendment (#68) **narrowed** the
`cohort ledger` rule to UX/service surfaces with the rationale embedded in
the rule text — driven by a product decision, proven both directions
(ledger *pages* still flagged; derivation language passes), and field-tested
one PR later (#70, data-layer language, zero flags). No rule has yet been
*added* from a rule-hit; every hit so far was an intentional docs mention.

**4. Prompt usage — any prompt used for a real task with checked outputs?**
**One of the nine has become operational code**: the watchdog rubber-ducky
prompt materialized as the CI action that has reviewed every PR since #50,
including the PRs that changed the ducky itself. The other eight have no
verified real-task usage recorded in the repository. Honest status: 1/9
proven, 8/9 unexercised.

**5. YOLO Steward internal pilot — first live invocation reviewed?**
**No evidence in the repository.** Not exercised during the v0.1 build-out.
Remains open; belongs to the persona lane, which stayed out of scope.

**6. External BYOC corpus — records beyond the one confirmed?**
**Two external records now, forming a complete fix-arc** (G5, #67):
`curationsdev/community` run `1cfefdca` (6/7, real `gitignore_coverage`
finding) → fix commit → run `e9560484` (7/7, `previous_run` lineage through
the one-click path). First external truthful delta:
`+gitignore_coverage vs run 1cfefdca`. Evidence:
`docs/audits/external/curationsdev-community/`.

**7. Cohort config timeline — stranger gate passed enough for the v0.2 PRD note?**
**The config outran the question**: `taxonomy/cohorts.yaml` shipped (Phase A,
#68) as a public *contract*, with the derived ledger published at
`docs/audits/cohort-ledger.json` (#70) — 2026-Q3 currently reads 5 runs,
2 journeys, first_fix_rate 1.0. The v0.2 **PRD note** still waits,
deliberately, for the one remaining gate item: the live stranger rehearsal
(real human, fresh account). Sequencing per the honest critique holds.

**8. Is the analyzer's single-rule-per-line `break` intentional?**
**Yes.** First matching rule wins per line (`watchdog_analyzer.py`,
`break` after append). It is a noise cap: a line tripping multiple patterns
yields one flag, keeping PR annotations readable. A line-level miss of a
second rule is acceptable because the same pattern almost always recurs on
other lines of any real scope-creep diff. Now documented here, on the record.

## Tier position, restated with today's evidence

- **Tier 1 "Good" — satisfied.** Lane merged end-to-end with Ducky comment +
  self-audit run-records + (beyond the bar) production deployment verified.
- **Tier 2 "Great" — partially satisfied.** Rules-file diff history exists
  (2 revisions, 1 rationaled learning step); external run-records: 2 of the
  assessment's ≥5 bar; prompt outcome captures: 1 of ≥3.
- **Tier 3 gap named by the assessment (cohort ledger unimplemented) has
  narrowed**: the derivation + published ledger exist; grounding-at-close
  remains contract-only (activation-gated workflow, schema shipped).
- **The assessment's summary judgment stands**: the moonshot gap is closed
  loops. One arc recorded, one external proof, zero cross-cohort walks.
  The next loop to close is the live stranger rehearsal.
