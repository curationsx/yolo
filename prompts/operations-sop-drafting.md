---
id: sop-drafting
title: Operations SOP Drafting
category: operations
version: 0.1.0
status: draft
license: MIT
tags: [operations, sop, process]
---

# Operations SOP Drafting

## Purpose and non-goals

**Purpose:** Turn a rough description of how a task gets done into a clear, testable standard operating procedure (SOP) draft with roles, steps, decision points, and failure handling.

**Non-goals:** Not for safety-critical, medical, legal, or regulated procedures — those need qualified professional authorship, with AI at most assisting formatting. The output is a *draft* for the process owner to correct, never a finished SOP.

## Required inputs

- A description of the process as actually performed (bullet points, transcript, or prose).
- Who performs it and who depends on the result.
- Known failure points or "gotchas" (if any).

## Prompt text

```text
You are an operations writer drafting a standard operating procedure from my
description. You know only what I tell you about this process.

Rules:
- If a step's trigger, actor, or completion condition is unclear from my
  description, insert [OWNER: clarify ...] rather than inventing it.
- Ask up to 5 clarifying questions first if the description is too thin to
  draft from.
- Keep language imperative and plain ("Send the report", not "The report
  should be sent").

Process description: {{process_description}}
Performed by / consumed by: {{roles}}
Known failure points: {{gotchas}}

Produce an SOP draft with:
1. Title and one-line purpose
2. Roles (who does what)
3. Preconditions (what must be true before starting)
4. Numbered steps, each with actor, action, and how you know it's done
5. Decision points as "If X, then step N; otherwise step M"
6. Failure handling for each known failure point
7. Rollback: how to safely stop or undo mid-procedure
8. Review note: sections most likely to need the owner's correction
```

## Expected output contract

- All eight sections present.
- Every step names an actor and a completion condition.
- Unknowns marked `[OWNER: clarify ...]`, never silently filled.
- Self-assessment of weak sections in section 8.

## Limitations and failure modes

- The model will happily produce a plausible-looking SOP from a vague description — the `[OWNER: clarify]` markers are your defense; their absence in a thin draft is a red flag.
- Steps performed "by feel" by experts resist proceduralization; expect those to need human rewriting.
- Edge cases the describer forgot stay forgotten; the SOP is only as complete as the walkthrough.

## Human review requirements

The process owner must walk through the draft while actually performing (or simulating) the process once, correcting every step. A second performer should then follow the corrected SOP cold. Do not publish an SOP no one has executed.

## Privacy and data handling

Replace real customer names, credentials, and internal URLs with placeholders before prompting. Never paste passwords, keys, or tokens as part of the process description.

## Evaluation checks

- Can someone unfamiliar with the process follow the steps without asking questions?
- Does every decision point have both branches?
- Is the rollback section actually executable?

## Example usage

**Input (fictional):** Process: monthly invoice run at the fictional Brightpath Tutoring — export sessions from the scheduling tool, check for unmarked sessions, generate invoices, founder reviews, then send. Gotcha: tutors sometimes forget to mark sessions complete.

**Conforming output sketch:** Eight-section SOP where step 2 ("Check for unmarked sessions") has actor *Ops coordinator*, completion condition *zero unmarked sessions or all exceptions listed*, a decision point routing exceptions to the tutor for confirmation, failure handling for the known gotcha, and rollback noting invoices are drafts until the founder's approval step — safe to delete before then.
