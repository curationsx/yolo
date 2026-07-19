---
status: silver
category: tasks
title: End-User Project Submissions — Audit Orchestration & Cohort Learning
created: 2026-07-18
promoted_from: 03-bronze/brain-dumps/2026-07-18-audit-orchestration.md
relates_to: PRD — End-User Project Submissions
owner: CurationsLA
---

# End-User Project Submissions — Audit Orchestration & Cohort Learning (Silver)

## 1. Purpose

End-users submit their public GitHub repos (via SSO) to Curations.DEV to have their PRD
empowered by AI Curators and the community. This artifact specifies the intake contract,
the composable audit orchestration, the cohort-based continual-learning layer, and the
public/private boundaries.

## 2. Intake Contract — Three Tiers

### Tier A — Always-on (locked scripts; free; every submission)
- **Repo Structure & Hygiene** (one artifact — structure is a subset of hygiene)
- **Tech Stack Detection** (fingerprinting only: languages, frameworks, deploy target)
- **Public-Facing Description baseline** (README/description quality score)
- **Security posture** (secrets scanning, exposed configs — duty of care)

### Tier B — Opt-in artifacts (checkboxes at submission)
- Design review
- Package/dependency audit (health, licenses, supply chain)
- Skills extraction ("what does this repo say you can do?")
- Tech Stack Audit (deep: fit, alternatives, modernization)
- Growth Audit (SEO, social motion elements, marketing copy)
- Technical Descriptions (docs/API consumers)
- Accessibility audit
- License clarity
- Contribution-readiness ("could a stranger contribute in 15 minutes?")
- Onboarding time-to-wow (clone → running; community-testable)

### Tier C — Community-facing requests
Separate checkbox **per artifact**: "I want human feedback on X."
Controls *publicity*, not *processing*.

## 3. Public / Private Boundaries

Rule: **scores public, diagnoses private-by-default, releasable per artifact.**

| Visibility | Contents |
|---|---|
| Public | Requested artifacts, badge-level results ("Hygiene: Gold"), growth deltas across runs |
| Private until released | Full curator commentary, specific findings, suggestions (owner clicks "publish this finding") |
| Never public | Anything security-related |

Deltas over runs are the social currency: "Improved 34% since Run 1" is shareable.

## 4. Orchestration — Capability Matrix

Not a script tree; a **capability matrix**:

- **Locked scripts** = required base pass (Tier A)
- **Domain scripts** = categorical (finance, CRM, e-commerce…), continually refined per vertical
- **Platform scripts** = deploy-target aware (Vercel, Azure Foundry, Cloudflare…)
- Orchestrator resolves `domain × platform × requested-artifacts` into a run plan
  (CRM-on-Vercel and CRM-on-Azure share the CRM module and swap the platform module)

Implementation: GitHub Actions matrix strategies + a manifest; domain/platform registries
live in `taxonomy/`; run-record schemas in `schemas/`.

### Run-records
Each script emits a schema-validated JSON run-record: findings, confidence, tokens spent,
script version. Run N reads Run N-1 for the same repo (continual molding). The platform's
own cohort-level runs use the same record format — self-audit on the same rails.

## 5. Triggers, Cadence, Quotas — DECIDED

- **Owner-only execution**: only the verified, SSO-authenticated PRD owner triggers runs.
  Community gets read + comment on published findings; never execute.
- **Mix-and-match re-runs**: the capability matrix is the re-run UI; partial runs allowed;
  run-record marks which matrix cells were exercised ("Hygiene unchanged — not re-audited").
- **Quotas**: per-owner run quotas (N re-runs per artifact per month; tier-able later).
- **Manual only**: the re-run is the return visit — the habit loop is the community.
  Passive nudges permitted ("40 commits since last run") — notification, never execution.
- **Community suggestion**: comments may *suggest* a re-run; surfaces as an owner nudge.

## 6. Cohort Learning — Temporal Knowledge Ledger — DECIDED

A cohort is a **temporal snapshot of aggregate inquiry patterns, not a pool of shared repo data.**
User A's repo never informs user B's suggestions directly.

- **Cohort A (e.g., Q3 2026)** = frozen inquiry snapshot; **immutable / append-only** once closed
- **Cohorts B…Z** = subsequent snapshots, each enriched by live ground-search at formation
- **Lineage walk at re-run**: original inquiry (Cohort A) → intervening snapshots → current
  live grounding (Cohort Z). Output: "here's what's new *relative to what you originally asked*,
  with full lineage of how the answer evolved."
- **Cohort boundary config** (first-class, versioned, in `taxonomy/`):
  `{open_date, close_date, trigger: calendar|event, event_ref}`
- **Consent** = one-line intake disclosure: *"Your inquiry categories contribute to anonymized,
  time-stamped trend aggregates."* No repo contents, no code patterns cross-pollinated.

Cohort ledger (macro, world trends) × run-records (micro, this repo's journey) = the two axes
of every suggestion.

## 7. Token Economics & Data Retention

- **Our tokens**: cheap deterministic passes + generation of the **suggestion plan**
  (structured artifact).
- **Their compute**: suggestion plan emitted as runnable commands — `gh` CLI invocations,
  Copilot prompts, installable GitHub Action. Heavy generative work runs on the end-user's
  side with their entitlements. We sell the map, not drive the car; we never write to their repo.
- **Azure Foundry as thin index**: fingerprints, run-records, file pointers (README/PRD paths
  the user designates), embeddings for cohort comparison. **Never repo mirrors.** Re-fetch
  fresh at run time.

## 8. Open-Core Split — DECIDED

| Layer | Open (this repo) | Private (Azure) |
|---|---|---|
| Contracts | Run-record schemas, artifact definitions, capability-matrix format, taxonomy structure | — |
| Interfaces | Script composition, cohort definitions, suggestion-plan format | — |
| Intelligence | — | Cohort ledger, refined domain scripts, orchestrator weighting, trend-ingestion pipeline, run-record corpus |

Proof rails public; engine room private. The private ledger is the load-bearing wall that
makes the public commons coherent.

## 9. Moonshot Ladder

- **Good**: checkbox intake → Actions run per artifact → private report
- **Great**: composable domain×platform scripts, run-records, delta tracking across runs
- **Amazing**: cohort intelligence + live-grounding trend ingestion versioning domain scripts
- **Moonshot**: recursive loop closed — the platform submits its own PRD to itself; run-records
  prove the curator improves run-over-run; the self-audit trail is **public**

## 10. Promotion Criteria → Gold

- [ ] Run-record JSON schema drafted in `schemas/`
- [ ] Capability-matrix manifest format drafted in `taxonomy/`
- [ ] Cohort boundary config format drafted in `taxonomy/`
- [ ] Intake checklist UX copy drafted (Tier A/B/C)
- [ ] Quota numbers proposed and reviewed
