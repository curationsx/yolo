---
status: bronze
category: roadmap
title: BYOC Compute Model — three lanes, gh-curations extension, free/paid split
created: 2026-07-18
relates_to: ../../02-silver/end-user-project-submissions/audit-orchestration.md
owner: CurationsLA
---

# BYOC Compute Model (Bronze — starting rough draft)

## Problem
Subsidizing comprehensive LLM reviews for every end-user PRD with our own tokens is
unsustainable for a creative-side project. Roadmap includes paid plans; today's
architecture must survive on near-zero token spend without weakening the private moat.

## Pattern: BYOC — Bring Your Own Compute
The suggestion plan is not a report — it's a **runnable script** executed by the end-user
with their own GitHub Copilot entitlement, via Terminal or Copilot CLI.

## The three-lane compute model

### Lane 1 — Our tokens (tiny, fixed cost per submission)
- Tier A locked scripts are **not LLM calls**: static analysis (regex, AST parsing,
  file-tree walks) — repo structure, gitignore coverage, secrets scanning, stack fingerprinting
- Run in GitHub Actions on our side → costs **compute minutes, not tokens**; nearly free
  on public-repo Actions tier
- Only real token spend: generating the suggestion plan (small, structured output)

### Lane 2 — Their tokens (the heavy generative work)
Orchestrator emits a runnable plan:

```bash
#!/usr/bin/env bash
# Curations.DEV suggestion plan — Run 2 — growth × skills
# Runs on YOUR machine, with YOUR GitHub Copilot entitlement.

gh extension install curationsx/gh-curations 2>/dev/null

# Each step feeds a Curations-authored prompt into the user's own Copilot CLI
gh copilot suggest -p "$(gh curations prompt growth/readme-social-preview --repo .)"
gh copilot suggest -p "$(gh curations prompt skills/extract --repo . --lens plain)"

# Results are structured locally, then the user chooses what to submit back
gh curations submit-results --run-id abc123 --review-first
```

We author the prompts (the intelligence); they burn the inference.
**We sell the map — they drive the car** (Silver §7, made literal).

### Lane 3 — Private Azure slice (unchanged, now cheaper)
- Azure never runs end-user inference
- Stores run-records, fingerprints, cohort ledger; *receives* structured results the user
  submits back via `gh curations submit-results`
- The ledger learns from every run without paying for any of them — moat deepens, meter off

## Why BYOC beats subsidizing (not just cheaper)
1. **Trust**: user watches every prompt execute on their own machine; nothing opaque
   happens to their repo on our servers
2. **Consent, structurally enforced**: `--review-first` means results reach our ledger only
   after user approval — the intake covenant enforced by the pipe, not policy
3. **Open-core boundary holds**: `gh-curations` extension is public (interface/contract);
   the prompt *library* is served per-run, per-entitlement from private Azure. Users run
   our intelligence without ever holding it. Prompts watermarked/versioned per run-record.
4. **Paid roadmap writes itself**:
   - **Free tier** = BYOC (bring your Copilot, run it yourself)
   - **Paid tier** = "we run it for you" — hosted execution, scheduled re-runs, priority
     curators, deeper cohort lineage reports
   - We gate **convenience, not features** — least-resented monetization line in software.
     Today's free architecture *is* the paid product's foundation.

## Honest constraint → Gold checklist addition
BYOC output quality varies with the user's model/subscription tier. Run-records must
capture `execution_context` (model, CLI version, entitlement type) — otherwise cohort
deltas compare apples to oranges. One field in the run-record schema.
