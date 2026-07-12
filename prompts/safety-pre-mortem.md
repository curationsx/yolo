---
id: pre-mortem
title: Pre-Mortem Facilitator
category: safety
version: 0.1.0
status: draft
license: MIT
tags: [safety, risk, planning]
---

# Pre-Mortem Facilitator

## Purpose and non-goals

**Purpose:** Facilitate a pre-mortem on a plan: assume it has already failed, generate distinct plausible failure narratives, and work backward to causes, early-warning signals, and mitigations — before you commit.

**Non-goals:** Not a risk quantifier (no invented probabilities or dollar figures) and not a decision-maker. It does not tell you whether to proceed; it makes the failure space visible so humans can decide.

## Required inputs

- The plan: what will be done, by whom, by when (roughly).
- What success looks like.
- Known constraints and dependencies.
- Appetite: which kinds of failure would be tolerable vs. unacceptable.

## Prompt text

```text
You are facilitating a pre-mortem. Time-travel: the plan below was executed
and it FAILED. Your job is to explain how.

Rules:
- Generate 5-7 DISTINCT failure narratives. Vary the failure type: at least
  one internal/execution failure, one external/environment failure, one
  people/communication failure, and one "quiet failure" where the plan
  technically completed but produced no value.
- For each: name it memorably, tell the short story of how it happened, then
  work backward to root cause, earliest warning signal, and one mitigation
  that could start now.
- No invented probabilities, statistics, or costs. Rank narratives only by
  how early their warning signal appears.
- If the plan is too vague to fail in specific ways, say so and ask up to 5
  clarifying questions instead.

The plan: {{plan}}
Success looks like: {{success_definition}}
Constraints and dependencies: {{constraints}}
Failure appetite: {{appetite}}

End with: the 3 warning signals worth monitoring from day one, and any
UNACCEPTABLE-per-my-appetite failure that lacks a credible mitigation.
```

## Expected output contract

- 5–7 named, genuinely distinct failure narratives covering the required types.
- Each narrative: story → root cause → earliest warning signal → actionable-now mitigation.
- No fabricated numbers.
- Closing section: top 3 signals + any unmitigated unacceptable failure.

## Limitations and failure modes

- Narratives skew toward generic project-failure tropes; the domain-specific disaster only your team could imagine may be missing. Use output to *start* the human session, not replace it.
- Can produce anxiety theater — seven vivid stories without prioritization discipline. The warning-signal ranking is the antidote; hold it to that.
- It knows nothing of your org's actual history unless you include it.

## Human review requirements

The plan owner and at least one skeptic review the narratives together, add the missing domain-specific ones, and explicitly accept or mitigate each unacceptable failure. The pre-mortem record becomes part of the plan's evidence trail.

## Privacy and data handling

Describe plans in role and category terms; avoid naming real individuals as failure causes. For sensitive plans (personnel, M&A), verify tool retention terms first or run the exercise with humans only.

## Evaluation checks

- Are the narratives distinct, or one failure re-costumed?
- Is the "quiet failure" present and plausible?
- Could you actually start each mitigation this week?

## Example usage

**Input (fictional):** Plan: the fictional Harborlight Museum migrates its membership records to a new CRM over one weekend. Success: all records migrated, renewals uninterrupted. Constraints: two staff, vendor support weekdays only. Appetite: data loss unacceptable; a week of manual workarounds tolerable.

**Conforming output sketch:** Six narratives including "The Silent Duplicates" (execution: merge logic doubles 400 members; signal: record count mismatch in the first test batch; mitigation: reconciliation count now), "Weekend Orphans" (external: vendor unreachable at Sunday failure; mitigation: reschedule cutover to Monday), and a quiet failure where migration succeeds but staff keep using exported spreadsheets. Closes with three day-one signals and flags data loss as needing a verified-restore backup before the weekend.
