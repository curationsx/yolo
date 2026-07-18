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
