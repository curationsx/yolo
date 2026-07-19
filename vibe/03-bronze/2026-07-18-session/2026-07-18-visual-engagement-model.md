---
status: bronze
category: ux
title: Visual Engagement Model — chips, KNOWS tags, threads, homepage pulses
created: 2026-07-18
relates_to: ../../02-silver/end-user-project-submissions/audit-orchestration.md
owner: CurationsLA
---

# Visual Engagement Model (Bronze — starting rough draft)

## Core rule
**Findings live once (project thread); everything else is a pointer.**
Homepage = pulse · Project page = story · Finding = chapter event · Comment = anytime · Delta = the picture worth sharing.

## Audits as conversation objects
- Published finding → posted as a message into the project's thread stream (thread anchor, not a page)
- Project page: threaded, chronological, grouped by run; findings render as collapsible cards (badge, delta, one-line summary; expand to read, reply inline)
- Homepage: activity pulses only — one line, deep-linked to the moment in the thread with timestamp anchor. Never the full card. No digital real-estate consumption.

## Outdated threads
- Old threads stay commentable forever
- Temporal context banner on superseded findings: "This finding is from Run 1 · superseded by Run 4 — view current"
- New comment on an old finding → natural trigger for the "suggest a re-run" owner nudge

## Chip system — DECIDED
- **Blue chips = Humans only.** One glance → you know the species. Trust primitive.
- **AI Curator chips = artifact-colored** (hygiene-green, growth-orange, etc.), colors sourced from `chip_color` in the taxonomy manifest
- Curator posts are unmistakably styled: distinct avatar frame + "Curator" chip + artifact-color accent
- Human-replies-to-curator exchanges are the product's soul — the most beautiful thing on the page

## KNOWS: specialty tags — DECIDED
- Format: `KNOWS: VERCEL`, `KNOWS: GOVTECH`, `KNOWS: CRM`
- Never "VERCEL AI CURATOR" — capability tag, not identity; clean trademark distance (no company association)
- Vocabulary lives in the same `taxonomy/` registry as domain/platform scripts — one vocabulary, two uses (curator chips + orchestrator routing); never diverges

## Four visual mechanics
1. **Growth sparkline / trajectory graphic** — the hero visual. Badge scores plotted across runs as a small motion element. Screenshot-able, shareable. Doubles as the submitter's social-media motion asset from the Growth Audit artifact (eat our own cooking).
2. **Curator visual identity** — see chip system above.
3. **"Watching" mechanic** — distinct from commenting. Watch a project → its run events appear in your homepage feed. Lurker participation verb, audience count for submitters ("47 watching"), homepage personalization engine for free.
4. **Run boundaries as visual chapters** — horizontal milestone dividers per run (date, matrix cells exercised, delta summary). Project page reads like a story. Outdated threads feel like *history*, not clutter.
