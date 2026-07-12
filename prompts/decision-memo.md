---
id: decision-memo
title: Decision Memo Drafter
category: decision
version: 0.1.0
status: draft
license: MIT
tags: [decision, memo, trade-offs]
---

# Decision Memo Drafter

## Purpose and non-goals

**Purpose:** Draft a decision memo from your raw thinking: the decision to be made, real options with honest trade-offs, evaluation against stated criteria, and a recommendation with its reasoning exposed for challenge.

**Non-goals:** The memo *proposes*; a named human *decides*. It must not manufacture consensus, invent evidence for a preferred option, or hide the weaknesses of the recommendation.

## Required inputs

- The decision to be made and by when.
- The options under consideration (the prompt may propose one additional option, clearly marked).
- Decision criteria and their rough priority.
- Known facts and constraints; who the decision-maker is.

## Prompt text

```text
You are drafting a decision memo for a human decision-maker. Your job is to
make the choice CLEARER, not to make it.

Rules:
- Use only the facts I provide; label anything else ASSUMPTION.
- Give every option a fair strongest case AND an honest weakest point,
  including the option you end up recommending.
- You may add ONE option I didn't list, marked [ADDED OPTION], if a genuinely
  different approach exists. Do not pad with strawmen.
- If my criteria conflict, surface the conflict; do not silently pick a side.
- The recommendation section must state what evidence would change it.

Decision and deadline: {{decision}}
Options: {{options}}
Criteria (prioritized): {{criteria}}
Known facts and constraints: {{facts}}
Decision-maker: {{decision_maker}}

Produce a memo with:
1. Decision required (one sentence) and deadline
2. Context (facts only)
3. Options: for each — description, strongest case, weakest point
4. Evaluation against each criterion (table)
5. Recommendation, with reasoning and "what would change my mind"
6. Risks of the recommended path and how to detect them early
7. Reversibility: how hard each option is to undo
```

## Expected output contract

- All seven sections; evaluation as a table.
- Every option has both a strongest case and a weakest point.
- At most one [ADDED OPTION].
- Recommendation includes explicit disconfirming-evidence conditions.

## Limitations and failure modes

- Models exhibit option-order and status-quo biases; re-run with options shuffled if the stakes warrant.
- A confident, well-formatted memo built on your unstated wrong assumption remains wrong — the ASSUMPTION labels only cover what the model knows it doesn't know.
- Criteria weighting is where the real judgment lives; the table can suggest false precision.

## Human review requirements

The decision-maker reads all options, not just the recommendation, verifies section 2 contains only true facts, and records the actual decision and reasoning separately (the memo is input, not the record). Consequential decisions get a second reviewer for section 4.

## Privacy and data handling

Use role names for decision participants where possible. Vendor negotiations, personnel matters, and legal positions should not be pasted into tools without verified retention terms.

## Evaluation checks

- Could a reader reconstruct why the losing options lost?
- Is the recommendation's weakest point stated as plainly as its case?
- Does "what would change my mind" name observable evidence?

## Example usage

**Input (fictional):** Decision: the fictional Petalworks florist chain must choose delivery: in-house driver, gig-platform couriers, or partnering with a local courier co-op, by end of month. Criteria: reliability > cost > brand experience. Decision-maker: operations lead.

**Conforming output sketch:** Memo evaluates all three plus one [ADDED OPTION] (hybrid: co-op weekdays, gig overflow weekends), recommends the co-op on reliability with its weakest point stated (capacity ceiling in peak season), notes "what would change my mind: co-op misses >5% of deliveries in a trial month," and rates gig couriers most reversible, in-house least.
