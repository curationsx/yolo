---
id: research-synthesis-review-publication
title: Research → Synthesis → Human Review → Publication
version: 0.1.0
status: draft
maturity: foundation
license: MIT
tags: [research, synthesis, publication]
---

# Research → Synthesis → Human Review → Publication

## Overview

Takes a research question from framing through source gathering, AI-assisted synthesis, human review, and publication — with attribution and a provenance trail intact. Use for briefs, blog posts, internal reports, and market summaries. Do not use for work requiring formal peer review or legal sign-off without adding those checkpoints.

## Actors

- **Researcher** (human) — owns the question, gathers sources, drives synthesis.
- **Reviewer** (human) — independent check of claims and citations; approves publication.
- **Synthesis model** (AI) — synthesizes provided sources; drafts prose.
- **Publishing owner** (human; may be the researcher) — executes publication and retraction if needed.

## Inputs and preconditions

- A written research question with scope and audience.
- Access to legitimate sources (licensed, public, or permissioned).
- A publication venue and its editorial rules.
- Reviewer availability confirmed before starting.

## Steps

1. **Frame** — *Researcher* writes the question, scope, audience, and what "answered" means. Done when a reviewer could restate the goal.
2. **Gather** — *Researcher* collects sources, recording origin and access date for each. Done when sources plausibly cover the question or gaps are noted.
3. **Synthesize** — *Researcher* runs the [source-synthesis prompt](../prompts/research-source-synthesis.md) with labeled sources. Done when output meets that prompt's contract.
4. **⛔ CHECKPOINT: Verify synthesis** — *Researcher* spot-checks citations against sources (all HIGH-confidence claims minimum). Failed checks send the run back to step 3 with corrections.
5. **Draft** — *Researcher*, with model assistance, turns the verified synthesis into audience-appropriate prose. AI involvement noted for disclosure. Done when the draft is complete with citations.
6. **⛔ CHECKPOINT: Independent review** — *Reviewer* checks claims-to-source mapping, balance, and disclosure. Outcome recorded: approve / revise / reject.
7. **Publish** — *Publishing owner* publishes with attribution and AI-assistance disclosure per venue norms. Done when live and linked in the evidence log.
8. **Learn** — *Researcher* records a 10-minute retro note: what the model got wrong, prompt revisions to propose. Feeds [prompt-change workflow](prompt-change-evaluation-review-release.md).

**Text flow equivalent:** frame → gather → synthesize → (checkpoint: verify) → draft → (checkpoint: review) → publish → learn; failed checkpoints loop back one step.

## Tools (replaceable categories)

- Source management: any reference or note tool.
- AI synthesis: any capable text model in a tool with acceptable data-handling terms.
- Drafting: any document editor with revision history.
- Publication: whatever the venue uses.

## Evidence captured

- Source list with origins and access dates.
- The synthesis prompt run's inputs and output.
- Spot-check record from step 4 (which claims, verified against what).
- Reviewer's decision and comments from step 6.
- Final published artifact and its disclosure statement.
- Retro note from step 8.

## Failure modes

- **Fabricated or drifted citations** — caught at step 4 if spot-checking is honest; the highest-value checkpoint here.
- **Source coverage gaps** — the synthesis is faithful to sources that don't cover the question; step 2's gap notes and the prompt's "gaps" section surface this.
- **Reviewer rubber-stamping** — mitigate by having the reviewer verify a random claim sample rather than reading for tone.
- **Disclosure omission** — publication checklist in step 7 includes it explicitly.

## Rollback and recovery

- Before step 7, everything is drafts: discard or revise freely.
- After publication: correct with a visible changelog for minor errors; retract with a notice for material errors. The *Publishing owner* executes; the evidence trail identifies what went wrong and where.

## Privacy considerations

Only process sources you may lawfully use. Strip personal data not essential to the research. Verify the AI tool's retention terms before submitting non-public sources; when unverifiable, use public sources only.

## Success measures

- Zero post-publication corrections traced to unverified claims.
- Spot-check pass rate at step 4 trending upward across runs (prompt improving).
- Time from framing to publication stable or falling without checkpoint erosion.
