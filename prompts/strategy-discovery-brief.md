---
id: discovery-brief
title: Strategy Discovery Brief
category: strategy
version: 0.1.0
status: draft
license: MIT
tags: [strategy, discovery, planning]
---

# Strategy Discovery Brief

## Purpose and non-goals

**Purpose:** Turn a fuzzy initiative ("we should do something about X") into a structured discovery brief: problem framing, stakeholders, unknowns, success signals, and a scoped first step.

**Non-goals:** This is not a business case, a project plan, or a decision. It produces the *questions and framing* that make those possible. It must not invent market data or stakeholder opinions.

## Required inputs

- A description of the initiative or problem area (even rough).
- Who is asking for it, and why now (if known).
- Any known constraints (budget ceiling, timeline, policy, team).

If any of these are missing, the prompt instructs the model to ask before drafting.

## Prompt text

```text
You are a strategy analyst helping me draft a discovery brief. Your job is to
structure my thinking, not to make decisions or invent facts.

Rules:
- If any required input below is missing or ambiguous, ask me up to 5
  clarifying questions BEFORE drafting anything.
- Clearly label every statement as FACT (from my input), ASSUMPTION (yours,
  flagged for my confirmation), or OPEN QUESTION.
- Do not invent market figures, competitor details, or stakeholder opinions.

My inputs:
- Initiative: {{initiative_description}}
- Requested by / why now: {{requester_and_trigger}}
- Known constraints: {{constraints}}

Produce a discovery brief with exactly these sections:
1. Problem statement (2-3 sentences, plain language)
2. Who is affected and how (stakeholder list with FACT/ASSUMPTION labels)
3. What we know (facts only, from my input)
4. What we assume (each assumption with a suggested way to test it)
5. Open questions (ranked by how much the answer would change our direction)
6. Success signals (observable, no invented metrics)
7. Suggested first step (smallest useful investigation, reversible)
```

## Expected output contract

- Either clarifying questions (≤5) *or* a brief with exactly the seven numbered sections.
- Every claim labeled FACT, ASSUMPTION, or OPEN QUESTION.
- No numbers, names, or quotes that did not appear in the inputs.
- First step is small and reversible.

## Limitations and failure modes

- Models may launder assumptions as facts despite instructions — the labels make this checkable but not impossible.
- Long, rambling initiative descriptions can produce a brief that mirrors the rambling; tighten the input.
- The model cannot know your politics; the stakeholder list will be structurally sensible but organizationally naive.

## Human review requirements

Before circulating: verify every FACT label against your actual input; confirm or strike every ASSUMPTION; sanity-check the stakeholder list with someone who knows the organization.

## Privacy and data handling

Do not include names of real individuals, unreleased financials, or confidential strategy in the inputs unless your AI tool's data handling has been verified for that class of information. Roles ("the ops lead") work as well as names.

## Evaluation checks

- Did it ask questions when inputs were thin, instead of guessing?
- Zero unlabeled claims?
- Is the first step something you could actually start this week and undo?

## Example usage

**Input (fictional):** Initiative: "Lumenbrew Coffee (a fictional 12-store chain) wants 'to do something with a loyalty app'." Requested by: founder, after a competitor launched one. Constraints: no in-house engineers; budget unknown.

**Conforming output sketch:** The model asks two clarifying questions (budget range? current customer data?), then produces a brief whose Problem Statement centers customer retention (labeled ASSUMPTION, with a test: pull repeat-purchase rates), lists stakeholders (store managers — FACT; baristas — ASSUMPTION), and proposes as first step a two-week analysis of existing point-of-sale data — reversible, cheap.
