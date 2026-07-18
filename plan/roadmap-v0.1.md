---
status: authoritative
category: roadmap
title: "v0.1 Roadmap — scope, cut-list, and release gate"
created: 2026-07-18
promoted_from: vibe/03-bronze/intervention-of-regression/2026-07-18-honest-critique.md
relates_to:
  - docs/audits/2026-07-18-silver-audit-synthesis.md
  - vibe/02-silver/end-user-project-submissions/audit-orchestration.md
  - docs/ROADMAP.md
owner: CurationsLA
---

# Roadmap — v0.1

> This file is the authoritative scope boundary for v0.1. It is promoted from
> the Bronze honest-critique artifact (`vibe/03-bronze/intervention-of-regression/
> 2026-07-18-honest-critique.md`) into a plan-level document so that scope gravity
> has a wall to hit.
>
> Rule: any new item must either displace something from the in-scope list or
> wait. "We'll add it carefully" is not an argument — scope creep is a sequencing
> failure, not an enthusiasm surplus.

---

## What v0.1 IS — the single-player Tier A loop

**One sentence:** submit your repo → get a Tier A hygiene report → share a badge.

In detail:

1. **GitHub SSO sign-in.** Authenticated user is the sole trigger for all runs.
2. **Repository selection.** Pick one public repo from SSO scope.
3. **Tier A run.** The hygiene audit executes via GitHub Actions in the submitter's
   own Actions minutes (BYOC). No LLM calls; no model spend on our side.
4. **Schema-valid run-record.** The run emits a JSON artifact that validates against
   `schemas/run-record.schema.json`, carries a pinned `commit_sha`, and includes
   `ruleset_version: "hygiene/0.1.0"` with per-cell `passed`/`total` check counts.
5. **Private receipt first.** All findings are private until the owner explicitly
   publishes a finding. Security findings are never public.
6. **Defensible badge.** The badge is count-form: `Tier A: 12/14 · hygiene/0.1.0`.
   No uncalibrated score bands (no "Gold/Silver/Bronze" labelling before cohort
   calibration exists).
7. **Re-run and delta.** Owner can re-run after making a change. Run 2 references
   Run 1 via `previous_run`. A truthful delta is shown: only the checks that changed
   are highlighted; unchanged checks are not re-labelled.
8. **Self-audit.** `curationsx/yolo` completes a run through the same intake and
   Action, producing a public run-record. This is the canonical integration test and
   the first reference project.

---

## What v0.1 IS NOT — frozen list

These items are explicitly deferred. They are architecturally pre-designed (cohort
ledger, lineage walk) or product-sketched (community, CLI) but must not be built
until the single-player Tier A loop is shipping reliably.

| Item | Earliest revisit | Why frozen |
|---|---|---|
| Threads / conversation layer | v0.2 | Requires live community; cold-start kills it |
| Cohort ledger + lineage walk | v0.3 | Requires ≥1 closed cohort of real submissions |
| Live-grounding lineage (enriched cohort snapshots) | v0.3 | Depends on cohort ledger |
| KNOWS: tags + curator identity system | v0.3 | Multiplayer; community-first |
| Watching mechanic / homepage pulses | v0.3 | Engagement loop; requires active users |
| `gh-curations` CLI extension | v0.2 | Terminal drop-off risk for Vibe Coder audience |
| Paid tier / CURATIONS Credits | v1.0 | Gate convenience, not features; free must work first |
| Broad domain × platform matrices | v0.2 | Requires calibrated Tier A as a baseline |
| Hosted generative audits (our inference budget) | v1.0 | Requires quota model and billing |
| Community feedback on findings | v0.2 | Requires moderation controls |
| Scoring / percent-delta badges | v0.2 | Requires cohort calibration |
| Organization / collaborator consent flows | v0.2 | Scope expansion after single-user proven |

---

## Release gate

v0.1 is ready to release when **a stranger** (someone with no knowledge of the
codebase, no maintainer assistance, and no prior session context) can:

1. Sign in via GitHub SSO.
2. Select their own public repository.
3. Complete a Tier A hygiene audit without any help or workaround.
4. Read at least one finding and understand what it means and why it matters.
5. Execute one recommended improvement in their repository.
6. Re-run the audit and observe a truthful delta — the fixed check passes, all
   other checks are unchanged, the badge count updates.
7. Share the commit-bound run-record result (a link or badge) with a colleague.

No step in this journey may require maintainer intervention, documentation lookup,
or manual schema patching. The runner produces the record; the record validates
against the schema; the badge reflects the record.

**Key metric: first successful fix rate.** Defined as: among users who complete
step 3, what fraction complete step 6? Target: ≥ 60 % before any community surface
is enabled.

---

## Scope gravity rule

Before adding anything to the in-scope list, answer:
- Does this advance the stranger-completion gate above?
- Does it displace an existing in-scope item, or is there explicit capacity for it?
- Is there a run-record or schema artifact that proves it works?

If any answer is "no", the item goes on the frozen list with a target version.
