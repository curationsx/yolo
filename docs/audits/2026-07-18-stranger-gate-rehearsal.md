# Stranger gate rehearsal — 2026-07-18

**Lane F of plan/vibe-coding-v0.1-foundation.md — the release gate itself.**

The gate: *a stranger signs in, picks their repository, runs a Tier A audit in
their own Actions, reads a private receipt, fixes one finding, re-runs, sees a
truthful delta, and shares a count-form badge — with no maintainer help.*

This rehearsal walks all seven steps as a stranger would meet them, against
the lane stack (#54 → #58) plus what is already on `main`. It is a desk
rehearsal executed by inspection of the shipped surfaces, tests, and guides —
every claim cites its evidence. Gaps are logged, not hidden. Per the lane
contract, this document changes no product code; fixes become scoped
follow-ups in the responsible lane.

## Verdict up front

**NOT YET PASS.** Every step is code-complete and proven by tests or visual
proofs inside the lane stack, but a real stranger cannot complete the loop
today because the stack is unmerged and the worker/site deployment
configuration is pending. Two functional gaps were also found (G3, G4).
The gate stays closed until the unblockers in the gap log land and this
rehearsal is re-run live by a person with a fresh account.

**First-fix success metric (target ≥60%):** not measurable in a desk
rehearsal; requires live strangers. Instrumentation note in G6.

## Step walkthrough

| # | Step | What the stranger meets | Evidence | Status |
|---|------|--------------------------|----------|--------|
| 1 | Sign in with GitHub | `/submit/project/` page, step "1 · Identity", `read:user` only, token discarded | PR #56; `docs/visual-proofs/lane-a/`; existing auth flow (`agent-worker/src/auth.ts`, untouched) | Code-complete; needs deploy (G1, G2) |
| 2 | Pick their repository | Step "2 · Your repository": URL input; refusals verbatim in coral. Non-owned → 403 naming both accounts; archived/fork → plain-language refusal | `agent-worker/test/audit-intake.test.mjs` (7/7) | Code-complete; needs deploy (G1, G2) |
| 3 | Run Tier A audit in their own Actions | Pinned caller workflow generated per-repo; `docs/audits/stranger-guide.md` documents the manual path that works **today on `main`** (reusable workflow since PR #48) | `.github/workflows/hygiene-audit-reusable.yml`; `docs/audits/external-byoc-test.md` (runbook — external execution still pending, G5) | Works today (manual path); one-click path needs deploy |
| 4 | Read a private receipt | Actions artifact `hygiene-run-record` is private by construction today; receipt store + `/receipts/` owner view add the product surface: private by default, security rows marked "never published", exact public preview | `agent-worker/test/audit-receipts.test.mjs` (8/8, falsifying proof held); `docs/visual-proofs/lane-d/` | Code-complete; needs deploy (G1, G2) |
| 5 | Fix one finding | Finding `detail` strings are plain language (e.g. run-2's failing `licence_present`, `sensitive_filenames`); our own run-2 → run-3 was exactly this loop | `docs/audits/run-records/run-2.json` → `run-3.json`; PR #47 | Proven by canonical arc; stranger comprehension untested live (G6) |
| 6 | Re-run, see truthful delta | `scripts/audit/delta.py` + site Δ line; identical re-run says "no change"; lineage + ruleset guards refuse untruthful comparisons | `scripts/audit/tests/test_delta.py` (6/6); `docs/visual-proofs/lane-e/` | Tool complete; BYOC lineage input missing (G3) |
| 7 | Share the count-form badge | Deterministic SVG + README snippet, `Tier A: N/M · hygiene/0.1.0`, linking to the public display | `scripts/audit/tests/test_badge.py` (7/7); `docs/visual-proofs/lane-c/` | Complete for self-audit records; no hosting path for stranger badges yet (G4) |

## Gap log

| ID | Gap | Severity | Falsifying-proof trigger | Responsible lane / follow-up |
|----|-----|----------|--------------------------|------------------------------|
| G1 | Lane stack #54→#58 unmerged — no stranger can reach any surface | Blocking | Maintainer intervention required (merge) | Ship gate: merge stack bottom-up |
| G2 | Worker + site deployment with `PUBLIC_AGENT_API` set; local builds honestly show "Identity gateway unavailable" | Blocking | Undocumented environment knowledge | Ops follow-up; document the deploy contract |
| G3 | Reusable workflow has no `previous_run` input, so BYOC re-runs cannot carry lineage — the delta tool then (correctly) refuses the comparison | High | Step 6 impossible for strangers without tribal knowledge of `--previous-run` | Lane E follow-up: one `workflow_dispatch` input + pass-through to `hygiene.py --previous-run`; document in stranger guide |
| G4 | Badge SVGs are served only for committed self-audit records; a stranger's published record has no badge URL | High | Step 7 dead-ends after publish | Lane C/D follow-up: serve `/badges/{run_id}.svg` for published receipts from the worker |
| G5 | ~~`external-byoc-test.md` is a runbook, not yet an executed external run~~ **CLOSED 2026-07-19**: runbook executed from `curationsdev/community` — run 1 `1cfefdca` (6/7, real `gitignore_coverage` finding), fix committed, run 2 `e9560484` (7/7, `previous_run` lineage) — first external truthful delta: `+gitignore_coverage vs run 1cfefdca`. Evidence: `docs/audits/external/curationsdev-community/` | ~~Medium~~ Closed | Step 3 evidence no longer self-referential | Done |
| G6 | ~~First-fix rate (≥60%) has no measurement hook~~ **CLOSED 2026-07-19**: measurement set computed by `scripts/cohort/derive.py` (first runs, linked re-runs, improved journeys, first-fix rate) and published verifiably at `docs/audits/cohort-ledger.json` via `.github/workflows/cohort-ledger.yml`. Current reading (2026-Q3, 2 journeys): **first_fix_rate 1.0** — above the ≥60% gate, small n acknowledged | ~~Medium~~ Closed | Metric now measurable and published | Done |

## What already holds without deployment

- The **manual BYOC path works today**: a stranger following
  `docs/audits/stranger-guide.md` on `main` can produce a schema-valid,
  pinned run-record in their own Actions with no maintainer help.
- Every lane's falsifying proof was executed and held (refusal of non-owned
  repos; security detail never public; "no change" says no change;
  byte-identical badges; honest empty states).
- The canonical fix loop is real: run-1 (4/7) → run-2 (5/7) → run-3 (7/7)
  with truthful deltas rendered on the public display.

## Re-run condition

This rehearsal is repeated **live** — fresh GitHub account, unaffiliated
repository, no maintainer contact — once G1–G4 close. The gate opens only on
a passing live walkthrough plus the measurement hook for first-fix rate.
