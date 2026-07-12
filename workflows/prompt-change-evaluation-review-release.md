---
id: prompt-change-evaluation-review-release
title: Prompt Change → Evaluation → Review → Release
version: 0.1.0
status: draft
maturity: foundation
license: MIT
tags: [prompts, evaluation, release]
---

# Prompt Change → Evaluation → Review → Release

## Overview

How a prompt in this repository (or your own library) moves from proposed change to released version — the executable form of the [PLAYBOOK](../PLAYBOOK.md) lifecycle stages test → review → version → release. Use for any change beyond typo fixes.

## Actors

- **Author** (human) — proposes and evaluates the change.
- **Target model(s)** (AI) — whatever the author evaluates against; recorded, not mandated.
- **Reviewer** (human) — independent review against the quality rubric.
- **Maintainer** (human; may be the reviewer) — merges and releases.

## Inputs and preconditions

- The existing prompt at a known version.
- A reason for the change (observed miss, new requirement, clarity).
- The prompt's own **Evaluation checks** section — the change is evaluated against it.
- A local clone with `python tools/yolo.py doctor` passing before changes.

## Steps

1. **Propose** — *Author* writes the change and the reason. Done when the diff exists on a branch.
2. **Evaluate before/after** — *Author* runs both old and new versions on the prompt's example input plus at least one real (sanitized) case, recording model/tool used and both outputs. Done when results are captured.
3. **Assess against contract** — *Author* checks both outputs against the prompt's Expected output contract and Evaluation checks; summarizes what improved, regressed, or stayed flat. Honest regressions noted, not hidden.
4. **Version and label** — *Author* bumps `version` per PLAYBOOK rules and adjusts `status` only to a level the evidence supports. `python tools/yolo.py doctor` passes.
5. **⛔ CHECKPOINT: Review** — *Reviewer* scores the revised prompt against the [rubric](../docs/QUALITY.md), reads the before/after evidence, and approves, requests changes, or rejects.
6. **Release** — *Maintainer* merges. The PR holds the evidence; git history is the changelog. Done when merged with doctor green.
7. **Observe** — *Author* (and users) note real-world misses against the new version, feeding the next cycle.

**Text flow equivalent:** propose → evaluate before/after → assess → version → (checkpoint: review) → release → observe.

## Tools (replaceable categories)

- Version control with PR review (this repo uses git/GitHub; any equivalent works).
- Any AI tool for evaluation runs — the workflow requires *recording* which, not using a specific one.
- The repository validator: `python tools/yolo.py doctor`.

## Evidence captured

- The diff and stated reason.
- Before/after outputs with model/tool and date recorded.
- Contract assessment summary (improved/regressed/flat).
- Reviewer's rubric notes and decision in the PR.

## Failure modes

- **Evaluation theater** — running only the example input, which the change was tuned to. The one-real-case minimum in step 2 counters this; more is better.
- **Status inflation** — promoting to `tested`/`stable` on thin evidence. Reviewer checks the label against the evidence in step 5.
- **Silent contract change** — the output contract shifted but the version bump says patch. Reviewer checks bump level matches the diff.
- **Model-specific tuning** — the prompt now only works on the author's model. Recording the model in evidence at least makes this visible.

## Rollback and recovery

Git revert restores any previous version cleanly; `status: retired` with a pointer handles supersession without deletion. Users pin to git history if they need an old version.

## Privacy considerations

Real cases used in evaluation must be sanitized before inclusion in PR evidence (PRs are public). Never commit outputs containing personal or confidential data.

## Success measures

- Every released change carries before/after evidence.
- Post-release misses per prompt trending down across versions.
- No status label exceeds its evidence (audit: sample releases quarterly).
