---
id: incident-triage-options-decision-learning
title: Incident → Triage → Options → Decision → Learning Review
version: 0.1.0
status: draft
maturity: foundation
license: MIT
tags: [incident, triage, decision, learning]
---

# Incident → Triage → Options → Decision → Learning Review

## Overview

Handles an incident or serious problem from detection through triage, option generation, an accountable decision, and a blameless learning review. AI assists with structuring and option-broadening; humans make every consequential call. Use for operational incidents, project derailments, and vendor failures. For safety-of-life, security breaches, or legally reportable incidents, your formal incident-response and notification obligations come first — this workflow can run alongside, never instead.

## Actors

- **Responder** (human) — first accountable person on the incident; drives triage.
- **Incident owner** (human; may be the responder) — owns the decision and communications.
- **Structuring model** (AI) — organizes facts, drafts timelines, broadens option lists. Never decides, never acts on systems.
- **Affected parties** (humans) — informed per communication rules; consulted where feasible.

## Inputs and preconditions

- A detected incident with an initial report (what, when noticed, apparent impact).
- A severity scale the team already understands.
- Known escalation contacts.
- Agreement that AI tools are not fed sensitive incident data beyond policy (see privacy).

## Steps

1. **Stabilize and record** — *Responder* takes any immediate containment action that is safe and reversible, and starts a timestamped incident log. Done when the situation is not actively worsening and the log exists.
2. **Triage** — *Responder* assesses severity against the scale: impact, spread, urgency, unknowns. The *structuring model* may organize raw observations into a draft timeline and unknowns list — marked as draft until human-verified. Done when severity and escalation are decided by the responder.
3. **⛔ CHECKPOINT: Escalation decision** — *Responder* escalates per the severity scale (or records why not). An accountable *Incident owner* is now named. Done when ownership is explicit.
4. **Options** — *Incident owner* generates response options; the *structuring model* may broaden the list (including the "do nothing yet, gather more" option) and lay out trade-offs in [decision-memo](../prompts/decision-memo.md) form — with model-drafted content labeled and facts verified against the log. Done when at least two real options exist with honest trade-offs.
5. **⛔ CHECKPOINT: Decision** — *Incident owner* decides, records the decision and reasoning in the log, and communicates to affected parties per severity rules. AI does not decide and does not execute the decision. Done when recorded and communicated.
6. **Act and monitor** — humans execute the decision; the log records actions and effects with timestamps. If effects diverge from expectation, return to step 4 with new facts. Done when the incident is resolved or formally downgraded.
7. **Learning review** — within a reasonable interval, run the [learning-review prompt](../prompts/retrospective-learning-review.md) on the incident log, then hold the blameless human session per that prompt's requirements. Done when follow-ups have accepted owners.
8. **Feed back** — severity scale, escalation contacts, and this workflow are revised from the review's follow-ups.

**Text flow equivalent:** stabilize → triage → (checkpoint: escalate) → options → (checkpoint: decide) → act and monitor (looping to options if diverging) → learning review → feed back.

## Tools (replaceable categories)

- Incident log: any timestamped shared document or incident tool.
- Structuring assistance: any text model under the privacy rules below.
- Communications: the channels affected parties actually read.

## Evidence captured

- The timestamped incident log (the spine of everything).
- Verified timeline and unknowns list.
- Options considered with trade-offs; the decision and its reasoning.
- Communications sent and when.
- Learning review record and follow-up owners.

## Failure modes

- **Acting before recording** — heroics with no log; the review then reconstructs from memory. Step 1 makes the log part of stabilization, not paperwork after.
- **AI-laundered facts** — the model's tidy draft timeline contains an inference stated as observation. All model output is draft until verified against the log (steps 2 and 4).
- **Ownership vacuum** — everyone responding, no one deciding. Step 3 exists precisely for this.
- **Skipped review** — resolved incidents feel finished; learning evaporates. Follow-up owners at step 7 are the workflow's definition of done.

## Rollback and recovery

- Containment actions in step 1 must themselves be reversible or explicitly justified in the log.
- Every option at step 4 includes its own undo path as a trade-off dimension.
- A wrong decision at step 5 is recoverable by design: monitoring at step 6 catches divergence and loops back with the log intact.

## Privacy considerations

Incident data is often sensitive: affected customers, security details, personal actions under stress. Feed AI tools only what policy permits — sanitized, minimal, role-anonymized. Security incidents may forbid external AI processing entirely; know before the incident, not during. The learning review's privacy rules (consent of those described) apply in full.

## Success measures

- Time from detection to named owner trending down.
- Every resolved incident has a log, a recorded decision, and a completed review.
- Repeat incidents of the same root cause trending toward zero.
