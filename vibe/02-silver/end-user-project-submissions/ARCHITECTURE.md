---
status: silver
category: tasks
title: Architecture — Audit Orchestration & Cohort Ledger
created: 2026-07-18
relates_to: audit-orchestration.md
---

# Architecture — Audit Orchestration & Cohort Ledger

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            CURATIONS.DEV                                 │
│                                                                          │
│  ┌───────────┐   SSO    ┌──────────────────┐                             │
│  │ End-User  ├─────────►│  Intake Contract │  Tier A (locked, always-on) │
│  │ (PRD      │          │  (checkboxes)    │  Tier B (opt-in artifacts)  │
│  │  owner)   │          └────────┬─────────┘  Tier C (community publicity)│
│  └─────┬─────┘                   │                                       │
│        │ owner-only          run plan = domain × platform × artifacts    │
│        │ re-run trigger          ▼                                       │
│        │ (quota-bounded)  ┌──────────────────┐      ┌──────────────────┐ │
│        └─────────────────►│   ORCHESTRATOR   │◄─────┤ Capability Matrix│ │
│                           │ (GitHub Actions  │      │ manifest         │ │
│                           │  matrix strategy)│      │ (taxonomy/)      │ │
│                           └───┬────────┬─────┘      └──────────────────┘ │
│                               │        │                                 │
│              ┌────────────────┘        └───────────────┐                 │
│              ▼                                         ▼                 │
│     ┌─────────────────┐                      ┌───────────────────┐       │
│     │  Locked scripts │                      │ Domain × Platform │       │
│     │  (Tier A)       │                      │ scripts (Tier B)  │       │
│     │  hygiene, stack │                      │ e.g. CRM × Vercel │       │
│     │  detect, desc,  │                      │      CRM × Azure  │       │
│     │  security       │                      │  finance × CFlare │       │
│     └────────┬────────┘                      └─────────┬─────────┘       │
│              │           run-records (JSON,            │                 │
│              └──────────► schema-validated) ◄──────────┘                 │
│                               │                                          │
│                               ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │              AZURE (PRIVATE — thin index, no repo mirrors)       │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │    │
│  │  │ Run-record  │  │ Fingerprints │  │  COHORT LEDGER           │ │    │
│  │  │ store       │  │ + file       │  │  (append-only, immutable)│ │    │
│  │  │ (Run N reads│  │ pointers +   │  │  Cohort A ─► B ─► … ─► Z │ │    │
│  │  │  Run N-1)   │  │ embeddings   │  │  each enriched by live   │ │    │
│  │  └─────────────┘  └──────────────┘  │  ground-search at close  │ │    │
│  │                                     └──────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│                    ┌──────────────────────┐                              │
│                    │   SUGGESTION PLAN    │  our tokens: plan generation │
│                    │ (gh CLI cmds, Copilot│  their compute: execution    │
│                    │  prompts, installable│  we never write to their repo│
│                    │  Action)             │                              │
│                    └──────────┬───────────┘                              │
│                               ▼                                          │
│  ┌─────────────────────────── COMMUNITY LAYER ─────────────────────────┐ │
│  │ Public: badges, deltas, requested artifacts                         │ │
│  │ Private-until-released: findings/commentary (owner publishes per    │ │
│  │ finding). Never public: security. Community: read + comment +       │ │
│  │ suggest-re-run (nudge only — never execute)                         │ │
│  └──────────────────────────────────────────────────────────────────── ┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Contracts

### 1. Intake Contract
- Input: SSO identity + public repo URL + Tier B checkboxes + Tier C publicity checkboxes
- Consent line: "Your inquiry categories contribute to anonymized, time-stamped trend aggregates."
- Output: initial run plan

### 2. Orchestrator
- Resolves `domain × platform × requested-artifacts` → run plan
- GitHub Actions matrix strategy; manifest in `taxonomy/`
- Enforces: owner-only triggers, per-owner quotas, partial-run cell marking

### 3. Run-Record (schema in `schemas/`)
```json
{
  "run_id": "uuid",
  "repo_fingerprint": "...",
  "matrix_cells": ["hygiene", "skills×growth"],
  "findings": [{ "artifact": "...", "confidence": 0.0, "detail": "..." }],
  "tokens_spent": 0,
  "script_versions": { "crm": "1.4.0", "vercel": "2.1.0" },
  "previous_run": "uuid|null",
  "cohort_ref": "2026-Q3"
}
```

### 4. Cohort Ledger (config in `taxonomy/`)
```json
{
  "cohort_id": "2026-Q3",
  "open_date": "2026-07-01",
  "close_date": "2026-09-30",
  "trigger": "calendar",
  "event_ref": null,
  "inquiry_buckets": { "crm": 0, "finance": 0, "skills-gap": 0 }
}
```
- Append-only; immutable after close
- Lineage walk at re-run: original cohort → intervening → live grounding

### 5. Suggestion Plan
- Structured, runnable: `gh` CLI commands, Copilot prompts, installable Action
- Executed on end-user's side with their entitlements
- Platform never writes to end-user repos

## Data Flows

| Flow | Direction | Contents | Never |
|---|---|---|---|
| Intake | user → platform | repo URL, checkboxes, consent | repo mirror |
| Audit | platform → repo (read) | fresh fetch at run time | stale copies |
| Storage | platform → Azure | run-records, fingerprints, pointers, embeddings | code contents |
| Suggestion | platform → user | runnable plan | writes to their repo |
| Cohort | run-records → ledger | inquiry categories (anonymized, aggregate) | cross-user repo data |
| Community | findings → public | badges, deltas, released findings | security findings |

## Open-Core Boundary

- **This repo (public)**: schemas, capability-matrix manifest format, cohort config format, suggestion-plan format, script composition interfaces
- **Azure (private)**: cohort ledger contents, refined domain scripts, orchestrator weighting, trend-ingestion pipeline, run-record corpus

## Recursive Self-Audit (Moonshot)

The platform submits its own PRD to itself using the same intake contract, same run-record
schema, same ledger rails. Its self-audit trail is public: "we eat our own cooking, verifiably."

---

## Audit Orchestration and the Project Evidence Registry

> Added 2026-07-18 — reconciliation note from the three-engine audit synthesis.
> Closes the "two audit engines" tension identified by GPT-5.6 Sol and documented
> in `docs/audits/2026-07-18-silver-audit-synthesis.md`.

**One project identity. One evidence model. One audit history.**

Audit runs are not a parallel product — they are a **phase of the Project Evidence
Registry ingestion lifecycle**. The sequence is:

```
Project submission
  → identity/ownership/evidence gate   (agent-worker/src/repository-verification.ts)
  → Tier A capability executor         (scripts/audit/hygiene.py — and future Tier A scripts)
  → run-record                         (schema-valid JSON artifact, commit-bound)
  → optional publication               (owner-controlled, per finding)
```

### Identity/ownership gate (`repository-verification.ts`)

`agent-worker/src/repository-verification.ts` is the **identity and evidence gate**.
It performs:

- SSO identity verification (GitHub OAuth → authenticated user)
- Repository ownership match (authenticated user must be the repo owner or an
  authorized collaborator)
- Immutable SHA resolution (GitHub API → current default branch HEAD, pinned to a
  commit SHA for the duration of the run)
- Deterministic stack observations (marker-based file checks at the pinned SHA —
  these are evidence declarations, not audit findings)

This gate does not run hygiene checks. It produces a verified `(repo_id, commit_sha)`
pair that is passed to the capability executor.

### Tier A capability executor (`hygiene.py` and subsequent scripts)

The Python runner consumes the `(repo_id, commit_sha)` pair produced by the gate.
It never re-derives ownership and never fetches HEAD of a mutable branch. It
executes the hygiene checks defined in `taxonomy/capabilities.yaml` against the
pinned SHA and emits a run-record that carries both the gate's verified identity
fields and the runner's findings.

### What this means in practice

- There is no second submission universe. A run-record cannot exist without a
  prior identity gate pass; the gate output is a required input to the executor.
- The TS verification code and the Python hygiene runner do not overlap. If a
  file check appears in both, it is because stack detection (evidence) and hygiene
  (audit finding) are different claims — evidence says "this file exists"; a hygiene
  finding says "this file should or should not exist and here is why."
- Future Tier A scripts (stack detection, security posture) follow the same pattern:
  they receive the verified identity from the gate and emit findings into the same
  run-record schema.
- Cohort aggregation, delta tracking, and badge display all read from run-records.
  They have one authoritative source.
