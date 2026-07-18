---
status: bronze
category: content-copy
title: First-Submission Clickpath — manifest-driven intake, two lenses, preset bundles
created: 2026-07-18
relates_to: ../../02-silver/end-user-project-submissions/audit-orchestration.md
owner: CurationsLA
---

# First-Submission Clickpath (Bronze — starting rough draft)

## Infrastructure principle: the intake form is not a form — it's a rendered manifest
The submission screen is **generated from the capability-matrix manifest in `taxonomy/`** —
the same file the orchestrator reads. Copy becomes data, not UI. Adding an artifact =
one manifest entry; intake screen, orchestrator, chip color, and project-page rendering
all update from one source. No drift between what the form promises and what scripts run.

### Manifest entry shape (to be schema'd for Gold)
```yaml
- id: growth
  tier: B
  locked: false
  chip_color: orange
  copy:
    plain: "Want more people to find and love this? SEO, social content, marketing copy."
    technical: "Meta/OG audit, content-copy generation targets, social motion asset opportunities."
    what_you_get: "A growth plan you can run yourself."
    example_finding: "Your README has no social preview — projects with one get 3x more clicks."
  community_option: true   # renders the Tier C toggle
```

## Wide-spectrum users: two lenses, one manifest
- Vibe Coder ↔ Technical Developer: **one flow with a lens toggle** (`plain` vs `technical` copy)
- Default lens inferred from GitHub profile signal (repo count, languages); always switchable
- Infrastructure cost ~zero; same manifest

## Clickpath (post-SSO)
- **Step 0 — Welcome (~40 words).** The covenant: "Pick a public repo. We'll run a free health
  check on every submission. Then you choose what else you want eyes on — ours (AI Curators)
  and, if you want, the community's. **Nothing is published without your say-so.**"
  (Most important line of copy on the platform — consent-first, before any checkbox exists.)
- **Step 1 — Repo pick.** Public repos from SSO scope. Consent line verbatim from Silver:
  "Your inquiry categories contribute to anonymized, time-stamped trend aggregates."
- **Step 2 — Tier A disclosure (not a choice).** Locked checks pre-checked, un-uncheckable:
  "These run on every project, free, always." UI must never imply they're optional.
- **Step 3 — Tier B selection.** Manifest-rendered artifacts + **three preset bundles**:
  - 🌱 "Just getting started" → hygiene focus + descriptions + onboarding
  - 🚀 "Ready to grow" → growth + skills + public-facing descriptions
  - 🔧 "Make it bulletproof" → packages + tech-stack audit + technical descriptions
  Bundles are manifest entries (`bundles:` block — named selections of artifact IDs).
  "Customize" reveals the raw matrix for technical users. Same data, two entry depths.
- **Step 4 — Tier C, per selected artifact.** "Also invite community feedback on this?" —
  default OFF. "You can publish any finding later. Nothing goes public automatically."
- **Step 5 — Receipt.** Render the orchestrator's resolved run plan pre-execution, in plain
  language: "Running: base health check + Growth + Skills. Estimated: a few minutes.
  You'll get: 2 badges, 2 private reports." **The receipt is the tutorial** — by Run 3
  users mix and match matrix cells like pros.

## Additions for the Silver → Gold checklist
- Manifest schema needs: `copy.plain`, `copy.technical`, `what_you_get`, `example_finding`,
  `chip_color`, `community_option`, and a `bundles:` section
- `KNOWS:` tag vocabulary lives in the same taxonomy as domain scripts
