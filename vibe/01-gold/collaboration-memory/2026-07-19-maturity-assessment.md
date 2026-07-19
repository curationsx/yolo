---
status: gold
category: assessment
title: "Watchdog Ducky & Collaboration-Memory System: Maturity Assessment"
created: 2026-07-19
relates_to:
  - docs/AOT.md
  - taxonomy/README.md
  - docs/PRD-curations-community.md
  - docs/PRD-project-evidence-registry.md
owner: CurationsLA
---

# Watchdog Ducky / Introspective Human × AI Collaboration-Memory System: Maturity Assessment

## 1. System Map — What the Repository Actually Contains

The "system" under assessment is not a single product; it is a layered stack of four interlocking components.

### 1.1 Component A — Watchdog Ducky (CI Scope Enforcer)
**What exists and is running:**
- **Execution engine:** `.github/actions/watchdog-ducky/watchdog_analyzer.py` — loads rules JSON, diffs the PR against `origin/<base>`, regex-scans every added line, emits GitHub native `::error` annotations and a PR comment.
- **Composite action:** `.github/actions/watchdog-ducky/action.yml`
- **Workflow:** `.github/workflows/watchdog-ducky.yml`
- **Ruleset:** `.watchdog-rules.json` (6 regex rules).
- **Playbook & Prompt:** `tools/watchdog-ducky-handoff.md` and `prompts/engineering-watchdog-rubber-ducky.md`.

The implementation is running (75 lines of stdlib Python). Its scope is narrow and correct: regex-match added lines, annotate, comment, exit non-zero. The introspective-learning claim relies on the diff history of `.watchdog-rules.json` being the learning dataset.

### 1.2 Component B — AoT Framework (Conceptual Architecture)
**What exists:**
- `docs/AOT.md` (Seven elements + loop), `taxonomy/README.md` (Eleven machine-readable dimensions).
- `MANIFESTO.md`, `docs/QUALITY.md`, `PLAYBOOK.md`.
- 5 draft workflows and 8 draft prompts.

The AoT framework is the conceptual backbone. **Gap:** every prompt is `status: draft` and every workflow is `maturity: foundation`. The feedback loop has not closed even once.

### 1.3 Component C — foundry-sim + YOLO Steward Agent (Agent Protocol)
**What exists:**
- `foundry-sim/foundry_client.py` and `foundry-sim/agent.py` (Protocol runner).
- `community/AGENT-IDENTITY-CARD.md` and `docs/PRD-aot-agent-protocol.md`.

Agent runner is functional in sim mode, with Azure mode guarded. Trust properties exist today: read + suggest only, mandatory disclosure header, code-enforced hard limits, separate git-ignored azure ledger.

### 1.4 Component D — CURATIONS.DEV Product + Run-Record Evidence System
**What exists:**
- PRDs (`PRD-curations-community.md`, `PRD-project-evidence-registry.md`).
- `schemas/run-record.schema.json` v1.1.0.
- Tier A runner (`scripts/audit/hygiene.py`), schema validator, and delta tool.
- BYOC reusable workflow (`.github/workflows/hygiene-audit-reusable.yml`).

## 2. The Documented Intended Learning Loop

1. **Watchdog Ducky self-improvement:** The git log of `.watchdog-rules.json` is the introspective-learning record. Currently, the dataset is empty (no revisions).
2. **Run-record lineage (AoT Feedback):** Run N reads Run N-1 (`previous_run`). Proven for deterministic hygiene checks; the moonshot (recommendations become accountable claims) is frozen until v0.3.
3. **Prompt/workflow lifecycle:** Observe → Revise → stable. No prompt has completed this lifecycle yet.

## 3. Privacy and Trust Boundaries

**Structural controls (code-enforced):**
- Read + suggest only agent runner.
- Model allowlist and hard cost/token/request limits.
- Separate git-ignored azure ledger; no credentials in CI.
- BYOC: audit runs on submitter's Actions minutes.

**Policy controls (documented):**
- Explicit human request required for agent invocation.
- Private-until-released findings.
- Anonymized cohort data; no session transcript capture.

**Undefined Trust Boundary:**
There is no stated threat model for the `workflow_dispatch` surface. `repo_url` is user-controlled; edge cases like tar-bombs or billion-file trees are an acknowledged limitation.

## 4. Maturity Ladder

### Tier 1 — Good
**Definition:** Delivers genuine single-player value. A stranger can independently use it, get something useful, and understand what they got.
- **Capabilities:** Watchdog Ducky runs reliably; stranger gate passes live; BYOC badge hosting works.
- **Evidence:** Rule-hit log covering ≥ 10 PRs; person with a fresh account completes all 7 steps.
- **Controls:** Output sanitized before commit; badge SVG serves only committed records.
- **Likely failure modes:** Deployment blockers stay unresolved; Ducky false positives create friction; 40-char SHA requirement is a barrier.

### Tier 2 — Great
**Definition:** The system's learning loops close at least once. Multiple users improve their projects. Community pilot begins.
- **Capabilities:** ≥ 3 Ducky rules amended from PR feedback; ≥ 1 prompt/workflow promoted to `stable`; YOLO Steward community pilot passed.
- **Evidence:** Git diff of rules JSON with PRs cited; ≥ 10 external project run-records in corpus.
- **Controls:** Rule changes go through PR review; no per-user tracking in measurements.
- **Likely failure modes:** Community pilot fails to start due to UX gaps; first-fix rate is low; prompts accumulate revision debt.

### Tier 3 — Amazing
**Definition:** Verifiable organizational memory. Recommendations are traceable, outcomes are measured. Cohort ledger is live.
- **Capabilities:** Cohort ledger active; lineage walk works; dispute/correction mechanic in live use; Tier B opt-in audits live.
- **Evidence:** ≥ 2 closed cohorts; public correction with lineage visible.
- **Controls:** Anonymized inquiry buckets; cost caps enforced for BYOC.
- **Likely failure modes:** Cohort calibration reveals hygiene checks aren't predictive; Bing-grounded enrichment introduces latency/cost spikes.

### Tier 4 — Moonshot / Top 0.1%
**Definition:** Publicly replayable, accountability-first record of how AI recommendations age.
- **Capabilities:** Temporal recommendation accountability; recursive self-audit loop is a reference artifact; Ducky adopted by external repos.
- **Evidence:** Lineage walk across ≥ 3 cohorts showing recommendation diffs; ≥ 12 self-audit run-records.
- **Controls:** Append-only ledger; human approves state transitions.
- **Likely failure modes:** Requires multi-year operational maintenance; Ducky SHA pinning introduces upstream support obligations.

## 5. Smallest Set of Questions for the Repository Owner

1. **Deployment status of G1/G2:** Are the lane stack PRs merged and the Azure worker + site deployed? (Blocking for "Good")
2. **Badge hosting (G4):** Is `/badges/{run_id}.svg` serving for published stranger receipts?
3. **Ducky rules revision history:** Has any PR triggered a rule-hit that led to a new rule being added?
4. **Prompt usage:** Has any of the 8 prompts been used for a real task with outputs checked?
5. **YOLO Steward internal pilot:** Has the first live invocation been reviewed?
6. **External BYOC corpus:** Are there other external run-records beyond the one confirmed?
7. **Cohort config timeline:** Is the stranger gate passed enough to begin the v0.2 PRD note?
8. **watchdog_analyzer.py behavior:** Is the single-rule-per-line `break` intentional?

## 6. Summary Judgment

The system is genuinely coherent and unusual for a v0.1 project. Differentiators include count-form badge semantics, dispute/correction in the schema from day one, BYOC economics, and the Watchdog Ducky eating its own cooking.

The honest gap between the current system and its moonshot is closed loops: the learning mechanisms exist, but none has completed a full cycle. The system has recorded one arc (run-1 to run-3) and one external proof-of-concept, but has not yet demonstrated it can remember across time, across cohorts, or across the revision of its own recommendations. This aligns with the "Honest Critique" to ship a small, real thing first.
