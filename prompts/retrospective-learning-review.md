---
id: learning-review
title: Retrospective Learning Review
category: retrospective
version: 0.1.0
status: draft
license: MIT
tags: [retrospective, learning, facilitation]
---

# Retrospective Learning Review

## Purpose and non-goals

**Purpose:** Turn raw retrospective material (notes, timeline, observations) into a structured, blameless learning review: what happened, what surprised us, contributing factors, and specific, owned follow-ups.

**Non-goals:** Not a blame apparatus — it analyzes systems and conditions, not personal fault. Not a substitute for the live conversation; it prepares and structures, humans do the learning. It must not invent events absent from the notes.

## Required inputs

- Raw material: notes, timeline, chat excerpts, or observations from the work being reviewed.
- What the plan or expectation was.
- Scope: what this review covers and doesn't.

## Prompt text

```text
You are facilitating a BLAMELESS learning review from my raw notes.

Rules:
- Blameless means: describe conditions and systems, not personal fault.
  Convert any "X messed up" in my notes into "the conditions under which
  this action made sense at the time".
- Use only events present in my notes; mark gaps as [NOT IN NOTES] rather
  than reconstructing plausibly.
- Separate observation ("deploy at 14:02") from interpretation ("we were
  rushing") and label interpretations as such.
- Follow-ups must be specific and small enough to owner-and-verify; no
  "improve communication" mush.

What was expected: {{expectation}}
What the notes say happened: {{raw_notes}}
Scope: {{scope}}

Produce:
1. Neutral timeline of events (observations only)
2. Expectation vs. reality: the significant gaps
3. What went well (specific, evidenced from notes)
4. Surprises: what the team's model of the system got wrong
5. Contributing factors (systems and conditions, blameless framing)
6. Proposed follow-ups: action | suggested owner role | how we'd verify done
7. Open questions for the live review discussion
```

## Expected output contract

- Timeline contains only note-sourced events; gaps marked [NOT IN NOTES].
- Interpretations labeled as interpretations.
- Zero blame framing anywhere.
- Follow-ups in action/owner-role/verification form.

## Limitations and failure modes

- Notes are already an interpretation; the review inherits their gaps and bias. The [NOT IN NOTES] markers show where memory-jogging is needed.
- Blameless conversion can shade into euphemism that obscures what happened — keep observations sharp even as framing stays kind.
- The model may over-generate follow-ups; cap what you carry forward to the few the team will actually do.

## Human review requirements

The people involved review the draft before any wider sharing — they correct the timeline and consent to how their actions are described. Follow-up owners are volunteered by humans in the live session, never assigned by the document. The review is finished when the team says it reflects what happened, not when the model does.

## Privacy and data handling

Retrospective notes often contain candid remarks about identifiable colleagues. Anonymize to roles before prompting, and treat the output with the same confidentiality as the input. For incidents involving customer data, follow your incident-handling policy first.

## Evaluation checks

- Would every person named-or-implied be comfortable reading section 5?
- Is each follow-up verifiable by an outside observer?
- Do the surprises reflect genuine model-of-the-world updates, not restated gaps?

## Example usage

**Input (fictional):** Expectation: the fictional Maple & Main bakery's first online pre-order day handles 50 orders smoothly. Notes: 82 orders by 9am; the printer queue jammed at 8:15; staff switched to reading orders off a tablet; two orders duplicated; one customer waited 40 minutes; afternoon was calm.

**Conforming output sketch:** Timeline of the six noted events with [NOT IN NOTES] marking when the duplicates were discovered; "went well" credits the tablet improvisation; surprises: demand model wrong by 60%+; contributing factors cite single-printer dependency and no order-volume forecast, blamelessly; follow-ups include "add a duplicate-order check to the morning routine — owner role: shift lead — verified by a duplicate-free next pre-order day."
