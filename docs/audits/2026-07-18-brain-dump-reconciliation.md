---
status: silver
category: audit
title: "Brain Dump Reconciliation — cohort learning, BYOC, engagement model vs shipped v0.1"
created: 2026-07-18
relates_to:
  - vibe/02-silver/end-user-project-submissions/ARCHITECTURE.md
  - vibe/02-silver/end-user-project-submissions/audit-orchestration.md
  - plan/roadmap-v0.1.md
  - docs/PRD-curations-community.md
  - docs/PRD-project-evidence-registry.md
owner: CurationsLA
---

# Brain Dump Reconciliation — 2026-07-18

Wyatt delivered the full architecture corpus (Brain Dump Bucket 1: the silver
architecture, audit-orchestration decisions, the verbatim session log, the
honest critique, the BYOC compute model, the first-submission clickpath, and
the visual engagement model) and delegated source-of-truth judgment. This
audit reconciles that corpus against the repository as it stands tonight —
after the six v0.1 lanes, the gap fixes, and the Azure discovery — and records
the adopted decisions.

**The one-line verdict: the dump is not a wish list — roughly half of it is
already shipped and proven, a quarter is schema-ready and dormant by design,
and the rest is now assigned to versions.** Nothing in the dump requires
relitigating a locked decision.

## 1. Already shipped — the dump's "future" that v0.1 delivered

| Dump concept | Where it lives now | Proof |
| --- | --- | --- |
| Tier A locked scripts, deterministic, free | `scripts/audit/hygiene.py` (7 checks, `hygiene/0.1.0`) | Self-audit runs 1→3; suite green |
| Run-records: schema-valid, immutable, lineage-linked | `schemas/run-record.schema.json` v1.1.0 + `docs/audits/run-records/` | 4/7 → 5/7 → 7/7 chain, `previous_run` intact |
| "Run N reads Run N-1" continual molding | `scripts/audit/delta.py` + site Δ lines | "no change" honesty proven by test |
| Deltas as social currency | Homepage truthful arc + count-form badge | PRs #54–#58 |
| One-click Action as primary BYOC path (critique Risk 2) | Pinned reusable workflow + generated caller with `previous_run` input | PRs #48, #60, #62 |
| Owner-only triggers, quota-bounded | `audit-intake.ts` ownership gate; receipts 20/day | PR #56, #57 tests |
| Private-until-released findings, per-finding publish | `/receipts/` + `redactForPublic` | Falsifying proof: seeded secret never leaked |
| Security never public | Severity-`fail` findings collapse to a count | PR #57 |
| Dispute/correction mechanic (critique Risk 5) | `dispute`/`correction` fields in schema 1.1.0 | Present in every real record |
| `execution_context` (BYOC apples-to-apples) | Schema field: model, cli_version, entitlement_type | Present in every real record |
| Working code before more docs (critique Risk 3) | The entire v0.1 lane stack | 210/210 worker, 27 pytest |
| Recursive self-audit moonshot — *first rung* | This repo audited itself on its own rails | Sprint-win handoff: **first-fix rate 100%** |

## 2. Schema-ready, deliberately dormant

These fields exist in every run-record today with no consumer yet. That is
correct open-core sequencing — contracts first, intelligence later:

- `cohort_ref` (currently `"v0.1-tier-a"`), `matrix_cells`, `tokens_spent`
  (0 for Tier A, by design), `dispute`, `correction`.

**Adopted decision — retroactive cohort derivability:** every record carries
`created_at`, so calendar-quarter cohort membership is *derivable after the
fact*. `"v0.1-tier-a"` maps retroactively to cohort `2026-Q3` the day the
cohort config ships. No backfill, no migration, no data loss from having
shipped v0.1 before the ledger. This was the cheapest possible insurance and
we already bought it.

## 3. Frozen stays frozen — now with assigned targets

The Watchdog Ducky enforces these on every PR (this document intentionally
trips several of its rules; the flags below are the system working, not a
mistake):

| Frozen item | Target | Reconciliation note |
| --- | --- | --- |
| Cohort ledger + lineage walking | **v0.2** (config format + Azure data layer), **v0.3** (lineage-walk UX) | The dump's temporal-ledger design is adopted as-written; see §4 for refinements |
| Threads / conversation layer | v0.3 | "Findings live once, everything else is a pointer" adopted as the design rule when it thaws |
| KNOWS: tags | v0.3 | Capability-not-identity + shared taxonomy vocabulary adopted |
| Watching mechanic / homepage pulses | v0.3 | Pulse-not-card rule adopted |
| gh-curations CLI | v0.3 | One-click Action remains the primary lane (Risk 2) |
| Paid tier | ≥ v0.3 | "Gate convenience, not features" stands |

## 4. Adopted refinements (new tonight, from Wyatt's dump)

1. **Sub-cohorts — engagement-frequency dimension.** Repeat submissions within
   one open cohort window form a sub-cohort (notation: `2026-Q3.r2` for the
   second return in-window). Costs nothing now: membership is derivable from
   `created_at` + `previous_run` lineage already in every record. Adopted into
   the cohort config draft (§6).
2. **Fall-off as signal, not failure.** Cohort retention/decay (users who
   never re-run) is a first-class aggregate metric derived from lineage — no
   new collection, no per-user tracking beyond what receipts already hold.
3. **Cohort labels.** Quarter form `2026-Q3` stays the primary `cohort_id`
   (sortable, matches the silver doc); full open/close dates live beside it in
   the config. Wyatt's date-stamped instinct (`Cohort 18-07-2026`) is honored
   by `opened_at`/`closed_at` fields and by event-triggered cohorts, whose ids
   carry the event date.
4. **"Live ground-search" gets a concrete name.** The intended implementation
   is **Grounding with Bing Search via Azure AI Foundry Agent Service** —
   bounded spend, citations required, invoked only at cohort close and cohort
   formation (not per-request). This goes into the v0.2 PRD note as the named
   service so the moonshot stops being abstract.
5. **Privacy-error logging per cohort.** Privacy incidents/errors are logged
   as aggregate counts inside the cohort window (same anonymized,
   inquiry-level rule as everything else in the ledger — never per-user
   dossiers).

## 5. Source-of-truth corrections (dump text that repo reality supersedes)

- **"Hygiene: Gold" badge wording** (dump §3) — superseded. Count-form only
  (`Tier A: 7/7 · hygiene/0.1.0`) per locked decision #1 in the sprint-win
  handoff. Quality labels stay frozen until cohort calibration exists.
- **Tier A scope** — the dump lists four Tier A scripts (hygiene, stack
  detect, description baseline, security posture). v0.1 ships hygiene only;
  the other three are the next capability-matrix cells, not retroactive scope.
- **"No Azure deployment needed for v0.1"** (handoff decision #5) —
  superseded by reality: the full Azure stack is live (`rg-yolo-prod`,
  gateway, SWA) and G2 redeploy is in flight. Run-records-in-git remains true
  and canonical for self-audit records.
- **Dump's run-record example** omits required fields — schema 1.1.0 is
  authoritative, not the illustrative JSON in the architecture doc.

## 6. Cohort boundary config — adopted format draft (v0.2 artifact)

Promotion-checklist item "cohort boundary config format drafted" is satisfied
here; it graduates to `taxonomy/cohorts.yaml` in the v0.2 lane that implements
the ledger's data layer. Format only — no implementation in v0.1:

```yaml
# taxonomy/cohorts.yaml (v0.2 — format adopted 2026-07-18)
cohorts:
  - cohort_id: "2026-Q3"
    opened_at: "2026-07-01"
    closes_at: "2026-09-30"
    trigger: calendar          # calendar | event
    event_ref: null            # e.g. a major platform release for event cohorts
    sub_cohort_window: true    # derive .r2/.r3 return-visit sub-cohorts
    inquiry_buckets: {}        # anonymized category counts, append-only
    grounding:                 # named service, bounded, cited
      provider: azure-foundry-bing-grounding
      invoked: [close, formation]
      spend_cap_usd: 0         # explicit, versioned, never silent
```

Consent line stays exactly one sentence (already in the intake covenant):
*"Your inquiry categories contribute to anonymized, time-stamped trend
aggregates."*

## 7. Watchdog Ducky as a case study — adopted, with boundaries

Wyatt's proposal: the ducky itself is a case study in an artifact that
"fine-grains over time" and learns predictability from our collaboration.
Adopted, with the trust boundaries that make it publishable:

- **What it learns from:** the repository's own public record — rule-hit
  history across PRs, PR bodies, review outcomes, and the versioned evolution
  of `.watchdog-rules.json` (6 rules at birth → whatever it becomes). All of
  it in-repo, all of it auditable.
- **What it never learns from:** private conversation logs, personal data, or
  any channel outside the repository. Persona-adaptive behavior (e.g., rules
  tuned to how this human×AI pair actually drifts scope) must be explicit,
  versioned in the rules file, and reviewable like any other change.
- **The case-study shape:** each rules-file change carries a one-line
  rationale citing the PR that motivated it. Over time the diff history of
  `.watchdog-rules.json` *is* the introspective-learning dataset — public,
  replayable, and honest about what the guardrail learned and when.
- The ducky keeps running on every PR, including the PRs that change the
  ducky. It reviewed this document too.

## 8. What happens next (unchanged priorities)

This reconciliation adds **zero** items to the active queue. The close-out
plan stands: G2 staging→production, G5 external run, G6 metric hook, G7 wiki,
live stranger rehearsal. The v0.2 PRD note (cohort config, named grounding
service, sub-cohorts, ducky case study) is written *after* the stranger gate
passes — single-player value first, exactly as the honest critique ordered.
