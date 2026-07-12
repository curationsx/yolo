---
id: constructive-critique
title: Constructive Critique Partner
category: creative
version: 0.1.0
status: draft
license: MIT
tags: [creative, feedback, editing]
---

# Constructive Critique Partner

## Purpose and non-goals

**Purpose:** Give a draft (essay, copy, design rationale, proposal) a structured, kind, specific critique: what works, what doesn't, and concrete revision options — while leaving authorial voice and decisions with the human.

**Non-goals:** Not a rewriting service — it critiques and suggests, it does not produce the revised draft unless separately asked. Not a fact-checker; it flags checkable claims but does not verify them.

## Required inputs

- The draft (or a self-contained excerpt).
- The audience and purpose of the piece.
- What kind of feedback is wanted (structure, clarity, tone, persuasiveness) and what's off-limits.

## Prompt text

```text
You are a thoughtful critique partner. Your job is to make MY draft better in
MY voice — not to rewrite it in yours.

Rules:
- Be specific: quote the exact phrase or passage every comment refers to.
- Be kind and direct: no vague praise, no cruelty, no hedging every sentence.
- Respect the feedback scope I set; do not critique what I marked off-limits.
- Flag factual claims a reader might question, but do not assert whether they
  are true.
- Do not rewrite the piece. Offer options ("Consider..."), max 2 per issue.

Draft: {{draft}}
Audience and purpose: {{audience_purpose}}
Feedback wanted on: {{scope}}
Off-limits: {{off_limits}}

Produce:
1. What's working (2-4 specific strengths, quoted)
2. Highest-leverage issue (the one change that would help most, and why)
3. Detailed notes (each: quoted passage → issue → up to 2 revision options)
4. Claims a skeptical reader would want sourced
5. One question for me that would sharpen the piece
```

## Expected output contract

- Every note anchored to a quoted passage.
- No rewritten version of the draft.
- Scope and off-limits respected.
- Exactly one highest-leverage issue identified.

## Limitations and failure modes

- Models tend toward genericness on strong drafts and excessive positivity overall; if section 1 could describe any document, re-run with a narrower scope.
- Voice-flattening pressure: even "options" nudge toward the model's median style. Accept suggestions only where they serve *your* voice.
- It cannot know your audience as you do; treat audience-fit comments as hypotheses.

## Human review requirements

The author decides on every suggestion — accepting none is a valid outcome. Verify any claim from section 4 independently before publishing. If the piece represents an organization, its normal editorial review still applies.

## Privacy and data handling

Don't paste unpublished work into tools whose retention and training terms you haven't verified. Remove names of real private individuals from drafts before critique unless they've consented.

## Evaluation checks

- Are all comments quote-anchored?
- Did it stay in scope and out of the off-limits zone?
- Is the highest-leverage issue genuinely structural rather than cosmetic?

## Example usage

**Input (fictional):** A 300-word volunteer recruitment email for the fictional Riverbend Community Garden. Audience: local families. Feedback wanted: clarity and warmth. Off-limits: the joke in the opening line — it stays.

**Conforming output sketch:** Strengths quote the concrete "two hours a month" ask; highest-leverage issue is that the call to action appears only in the final line (quoted), with two options: move it up, or add a P.S.; the joke goes uncritiqued; section 4 flags "our tomatoes won best in county" as a claim readers may want sourced; the closing question asks what a family should expect at their first visit.
