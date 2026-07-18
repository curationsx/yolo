---
status: silver
category: audit-synthesis
title: "Silver Audit Synthesis — three-engine review × PR #43 × live main"
created: 2026-07-18
engines: [GPT-5.6 Sol, Kimi K2.7 Moonshot, Claude Fable 5]
relates_to:
  - vibe/02-silver/end-user-project-submissions/audit-orchestration.md
  - vibe/02-silver/end-user-project-submissions/ARCHITECTURE.md
  - vibe/03-bronze/intervention-of-regression/2026-07-18-honest-critique.md
  - vibe/03-bronze/roadmap/2026-07-18-byoc-compute-model.md
  - vibe/03-bronze/ux/2026-07-18-intake-clickpath.md
owner: CurationsLA
---

# Silver Audit Synthesis — 2026-07-18

> Curated synthesis of the three-engine review (GPT-5.6 Sol, Kimi K2.7 Moonshot,
> Claude Fable 5), cross-referenced against draft PR #43
> (`copilot/build-hygiene-audit-script`) and live `main` at 2026-07-18.
>
> Purpose: establish shared ground before the sprint, surface unresolved tensions
> explicitly, and name exactly what is frozen until after v0.1.

---

## 1. Current state

### What PR #44 established (merged)

PR #44 landed the following design artifacts:

| Artifact | Location | What it decided |
|---|---|---|
| Audit Orchestration (Silver) | `vibe/02-silver/end-user-project-submissions/audit-orchestration.md` | Tier A/B/C intake contract; composable capability matrix; owner-only re-run; cohort as a temporal aggregate, not a shared pool |
| Architecture (Silver) | `vibe/02-silver/end-user-project-submissions/ARCHITECTURE.md` | System diagram; component contracts; open-core boundary (public schemas/interfaces, private ledger) |
| Honest Critique (Bronze) | `vibe/03-bronze/intervention-of-regression/2026-07-18-honest-critique.md` | Cold-start risk; BYOC funnel-leakage risk; docs-ahead-of-reality risk; scope-gravity risk; dispute/correction mechanic requirement; explicit v0.1 cut-list |
| BYOC Compute Model (Bronze) | `vibe/03-bronze/roadmap/2026-07-18-byoc-compute-model.md` | Three-lane compute model: our tokens (Tier A scripts), their compute (suggestion plan execution), private Azure (thin index); `execution_context` field requirement |
| Intake Clickpath (Bronze) | `vibe/03-bronze/ux/2026-07-18-intake-clickpath.md` | Manifest-driven intake; two-lens (plain/technical) UX; manifest entry shape; preset bundles |
| Visual Engagement Model (Bronze) | `vibe/03-bronze/ux/2026-07-18-visual-engagement-model.md` | Public board surface conventions |

Trust model summary from PR #44: immutable run-records with `previous_run` lineage,
cohort A→Z temporal snapshots (append-only, closed immutable), `dispute`/`correction`
lineage in run-records, owner-only execution with community read+comment only. Economic
boundary: Tier A costs compute minutes (not LLM tokens); heavy generative work runs on
the end-user's entitlement.

### What PR #43 is delivering (draft, in flight)

PR #43 (`copilot/build-hygiene-audit-script`) adds the first executable Tier A rail.
**Do not duplicate or conflict with PR #43's files.**

| Deliverable | File | Status |
|---|---|---|
| Run-record JSON Schema (draft 2020-12) | `schemas/run-record.schema.json` | Added in PR #43 |
| `execution_context` field | inside run-record schema | Added in PR #43 |
| `dispute` / `correction` lineage fields (nullable) | inside run-record schema | Added in PR #43 |
| Tier A hygiene script (local path + shallow clone) | `scripts/audit/hygiene.py` | Added in PR #43 |
| Schema validator | `scripts/audit/validate.py` | Added in PR #43 |
| One-click GitHub Actions workflow (`workflow_dispatch` + PR-scoped) | `.github/workflows/hygiene-audit.yml` | Added in PR #43 |
| Self-audit pytest fixture (schema-valid run-record) | pytest suite | Added in PR #43 |
| Fixture tests: clean→pass, missing `.gitignore`→warn, `.env`→fail | pytest fixtures | Added in PR #43 |

---

## 2. Consensus findings across all three engine reviews

All three engines (Sol, Kimi, Fable) converged on the same four conclusions:

### (a) Design work is done; execution is the gap

The architecture designed in PR #44 is sound: compositional Tier A/B/C model, temporal
immutable run-records with cohort lineage, economic boundary (our compute + their
inference), honest Bronze critique all hold. The gap is not design — it is a working
script and a schema-valid run-record artifact. PR #43 closes this gap.

### (b) Run-record schema is the keystone contract

Every downstream component — badge display, delta tracking, cohort aggregation, dispute
resolution, community trust — depends on the run-record being authoritative. It must
include:
- `execution_context`: model version, CLI version, entitlement type (so cohort deltas
  compare like-for-like runs)
- `dispute` / `correction` lineage: nullable objects with `contested_at`, `re_evaluated_by`,
  `correction_detail`, `lineage_run_id` — the dispute mechanic turns failure into
  differentiator (PR #43 includes these)
- `ruleset_version`: which capability version produced this record (e.g. `hygiene/0.1.0`)
- Per-cell `passed` / `total` check counts: so a badge is auditable, not just a label

### (c) The next milestone is a single end-to-end run

"Submit one repo → run one deterministic audit → emit one valid run-record → display one
defensible badge." This is the sprint exit gate. Every PR that doesn't advance this loop
is a distraction until it is achieved.

### (d) One-click GitHub Action is the real BYOC path for the Vibe Coder audience

Terminal scripts have brutal drop-off for the first-time Vibe Coder (Kimi's primary risk
flag, echoed in the honest-critique BYOC funnel-leakage risk). A `workflow_dispatch`
GitHub Action that runs in the submitter's own Actions minutes is the correct UX. PR #43
implements this. The `gh-curations` CLI extension remains a valid later-stage deliverable
but must not be the primary v0.1 path.

---

## 3. Unresolved tensions (must not be papered over)

### Tension A — Two audit systems sitting beside each other

**The situation.** `agent-worker/src/repository-verification.ts` already performs:
- Repository ownership verification (SSO identity → GitHub API → repo owner match)
- SHA resolution (pinning to an immutable commit for evidence)
- Deterministic stack observations (marker-based file checks against the pinned commit)

PR #43 adds a Python hygiene runner (`scripts/audit/hygiene.py`) that performs its own
repo fetch and file-tree inspection.

**Sol's warning.** Do not build a second audit engine that duplicates ownership
verification. If two systems independently fetch and inspect the same repository without
explicit hand-off, the run-record has two unlinked provenance chains and no single source
of truth for "which commit did this audit observe?"

**Resolution (decided here, reflected in `ARCHITECTURE.md`).** These are not competing
systems; they are two phases of a single lifecycle:

```
Project submission
  → repository-verification.ts  (identity gate: owner match, SHA resolution, stack observations)
  → Tier A runner (hygiene.py)   (capability executor: receives verified repo_id + immutable SHA)
  → run-record                   (carries both: verified identity from TS gate + hygiene findings from Python runner)
  → optional publication
```

`repository-verification.ts` is the **identity/ownership/evidence gate**. It never runs
hygiene checks. The Python Tier A runner is the **capability executor**. It consumes the
verified `(repo_id, commit_sha)` pair from the gate — it never re-derives ownership. Audit
orchestration is a **phase of the Project Evidence Registry lifecycle**, not a parallel
product. See the reconciliation section in
`vibe/02-silver/end-user-project-submissions/ARCHITECTURE.md`.

### Tension B — Badge semantics and premature "Gold" language

**The situation.** An early draft of PR #43 used `badge_level: gold|silver|bronze|needs-work`
before any calibration data exists. Sol explicitly warned that uncalibrated score bands
applied to end-user projects before a cohort exists are unearned and create a misleading
trust signal.

**Resolution.** Badges must be:
1. **Ruleset-bound**: `Tier A: Complete · 12/14 checks · hygiene/0.1.0`
2. **Reproducible**: anyone can re-run with the same ruleset version and verify the count
3. **Count-carrying**: `passed`/`total` per cell so "14 of 14" means something

The `badge_level` enum is acceptable as a convenience label *only if* the run-record also
carries `ruleset_version` and per-cell check counts. Public-facing copy must never say
"Gold" about the project before v1.0 ruleset calibration; use the count form instead.
Never use "Gold" as an achievement label for the platform itself.

---

## 4. Frozen until after v0.1

The following items are explicitly out of scope until v0.1 is shipping reliably.
Adding any of these requires displacing something from the in-scope list first.

| Item | Earliest revisit |
|---|---|
| Cohort ledger (aggregate inquiry patterns, lineage walk) | v0.3 |
| Live-grounding lineage (enriched cohort snapshots at close) | v0.3 |
| Watching mechanic / homepage pulses | v0.3 |
| KNOWS: tags + curator identity system | v0.3 |
| Threads / conversation layer | v0.3 |
| `gh-curations` CLI extension | v0.2 |
| Paid plans / CURATIONS Credits hosted execution | v1.0 |
| Broad domain × platform matrices (CRM, finance, Vercel, Azure…) | v0.2 |
| Hosted generative audits (LLM runs on our side at scale) | v1.0 |
| Community feedback on findings | v0.2 |

---

## 5. The moonshot

A verifiable memory layer for software projects.

AI recommendations become accountable claims whose outcomes are measured over time:

```
intent → evidence → finding → recommendation → intervention → commit → rerun
  → measured outcome → correction/retained learning
```

The recursive loop: a recommendation that is wrong, corrected publicly, and then verified
improved is more trustworthy than one that was simply never challenged.

The recursive self-audit of `curationsx/yolo` is the first permanent reference project.
The platform submits itself through the same intake contract it offers end-users, using
the same run-record schema and the same badge semantics. Its self-audit trail is public
and append-only: "we eat our own cooking, verifiably."

The institutional-memory differentiator is the lineage answer:

> "You asked X in Q3 2026. The best answer at the time was A. It became B when [tech]
> shipped in Q1 2027. Here is the diff between A and B, and here is why the
> recommendation changed."

No other tool in this space offers that. Cohort ledger + immutable run-records + lineage
walk across cohorts is what makes it possible — which is why those components are
architecturally pre-designed even though they are frozen for v0.1 execution.

---

## 6. Sprint exit gate

**Definition of done for this sprint:**

> `curationsx/yolo` audits itself via the GitHub Action (PR #43), produces a
> schema-valid, commit-bound run-record artifact, and a rerun after one fix shows a
> truthful delta (the changed check flips from fail to pass; all other counts are
> unchanged).

**Key metric: first successful fix rate.**

Measurement: between Run 1 and Run 2 on `curationsx/yolo`, at least one previously
failing check passes, the total check count is unchanged, and the `previous_run` field
in Run 2 references Run 1's `run_id`. No manual schema patching permitted — the runner
produces the record.

---

## 7. Cross-reference table: three engines × PR #43 × live main

| Demand (consensus) | PR #43 | Live `main` | This PR |
|---|---|---|---|
| `schemas/run-record.schema.json` | ✅ Added | ❌ | — |
| `execution_context` field | ✅ Included | ❌ | — |
| `dispute` / `correction` lineage | ✅ Included | ❌ | — |
| Tier A hygiene script | ✅ `scripts/audit/hygiene.py` | ❌ | — |
| Schema validator | ✅ `scripts/audit/validate.py` | ❌ | — |
| One-click GitHub Action | ✅ `.github/workflows/hygiene-audit.yml` | ❌ | — |
| Self-audit pytest (schema-valid record) | ✅ | ❌ | — |
| Fixture tests (clean / warn / fail) | ✅ | ❌ | — |
| `taxonomy/capabilities.yaml` (one entry) | ❌ Not in PR | ❌ | ✅ This PR |
| Promoted v0.1 roadmap cut-list | ❌ Not in PR | ❌ | ✅ This PR |
| Registry reconciliation note in ARCHITECTURE | ⚠️ Not addressed | ❌ | ✅ This PR |
| Ruleset-bound badge language guidance | ⚠️ Needs `ruleset_version` + counts | — | ✅ Documented above |
| Measurement hooks specification | ❌ Not in PR | ❌ | ✅ This PR |
| Cohort boundary config | ❌ Correctly frozen | ❌ | ❌ Frozen |
