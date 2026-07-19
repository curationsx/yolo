---
status: bronze
category: intervention-of-regression
title: Honest Critique — session risks, sequencing, and the v0.1 cut-list
created: 2026-07-18
relates_to: ../../02-silver/end-user-project-submissions/audit-orchestration.md
owner: CurationsLA
---

# Honest Critique (Bronze — intervention of regression)

> Captured verbatim-in-spirit from the 2026-07-18 session. The concept is real; the risks
> are in sequencing, friction, and gravity — not in the design.

## Verdict up front
The core idea is genuinely good: "submit your repo, get AI + community feedback, watch
projects grow over time" solves a real problem — most side projects die in silence with
zero feedback. The temporal cohort ledger and BYOC split are legitimately clever;
"gate convenience, not features" is a sound monetization line. Architecture is sound,
moat logic holds. The project is at the exact moment where great side projects either
ship a small ugly v0.1 or document themselves to death.

## Risk 1 — Cold-start problem (the big one)
Every mechanism designed this session — community feedback, watching, cohort intelligence,
thread engagement — assumes people are *there*. A community platform with 12 users is a
ghost town, and ghost towns repel the users who'd populate them. Cohort A with 9
submissions produces statistically meaningless "trend intelligence."

**Prescription: single-player value first, multiplayer later.** The AI Curator audit must
be so good it's worth using with ZERO community. If the solo audit isn't a "holy shit"
moment on Run 1, the community never forms and the cohort architecture doesn't matter.
Reframe the roadmap around this.

## Risk 2 — BYOC funnel leakage
The spectrum problem cuts against the compute model: the first-time Vibe Coder — the
emotional target user — is the *least* likely person to run a shell script from the
internet in a terminal. The people comfortable with `gh curations` are the technical
developers who need the help least. Expect brutal drop-off between "checked the boxes"
and "ran the plan."

**Mitigation:** a GitHub Action installed with one click (runs in *their* Actions minutes)
is far gentler than a terminal script — same BYOC economics. Name this as a first-class
risk in the PRD, not a footnote.

## Risk 3 — Docs ahead of reality
This session produced six artifacts, schemas, diagrams, and a monetization strategy —
and zero working code. Fine for one night; a failure mode as a pattern. The repo already
carries PRDs, manifestos, playbooks, and a plan folder; the vision-to-running-software
ratio is tilting.

**Prescription: the next session produces exactly one thing — a Tier A hygiene script
that takes a repo URL and emits a valid run-record.** Ugly, minimal, real. Everything
designed tonight becomes 10x more credible the moment one matrix cell executes.

## Risk 4 — Scope gravity
One session designed: an audit engine, a social platform, a curator identity system,
a cohort learning ledger, a CLI extension, and a business model. Each is a company.

### The v0.1 cut-list (explicit)
**v0.1 IS:** submit repo → get Tier A report → share a badge. That's it.

**v0.1 IS NOT (deferred ≥ v0.3):**
- Threads / conversation layer
- Cohort ledger + lineage walking
- KNOWS: tags + curator identity system
- Watching mechanic / homepage pulses
- gh-curations CLI extension
- Paid tier

Write additions against this list; anything new must displace something or wait.

## Risk 5 — The failure story (missed entirely this session)
What happens when a curator gives *bad* advice publicly? A wrong finding, visible to the
community, is a trust-killing event — and with LLMs it WILL happen.

**Required: a dispute/correction mechanic in the run-record schema** —
finding contested → curator re-evaluates → correction posted with lineage.
Handled gracefully and publicly, this becomes a differentiator: nobody in the AI-tools
space does humility well.

## Gold checklist additions
- [ ] Run-record schema: `dispute` / `correction` fields with lineage
- [ ] PRD: BYOC funnel-leakage named as first-class risk; one-click Action as primary path
- [ ] Roadmap re-sequenced: single-player v0.1 before any community mechanics
- [ ] Next session deliverable: working Tier A hygiene script → valid run-record
