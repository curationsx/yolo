---
id: client-intake-risk-check-draft-plan-approval
title: Client Intake → Risk Check → Draft Plan → Approval
version: 0.1.0
status: draft
maturity: foundation
license: MIT
tags: [client, intake, risk, planning]
---

# Client Intake → Risk Check → Draft Plan → Approval

## Overview

Takes a new client or project request from intake through a structured risk check to an AI-assisted draft plan, approved by an accountable human before anything is promised to the client. Use for agencies, consultancies, and internal service teams. Not a substitute for legal, compliance, or conflict-of-interest processes where those exist — it feeds them.

## Actors

- **Intake owner** (human) — receives the request, runs intake and risk check.
- **Risk reviewer** (human; senior) — judges flagged risks; owns the go/no-go.
- **Planning model** (AI) — drafts the plan skeleton from approved intake facts.
- **Engagement owner** (human) — owns the plan, the client relationship, and final approval.

## Inputs and preconditions

- A client request in writing (email, form, brief).
- An intake template: who, what, why, constraints, budget signal, timeline signal.
- The organization's risk checklist (or the starter list in this workflow).
- Client is aware of and consents to your data-handling practices, including AI assistance where disclosure is required or promised.

## Steps

1. **Intake** — *Intake owner* completes the template from the request, marking unknowns as unknowns. Done when every field is filled or explicitly open.
2. **Risk check** — *Intake owner* screens against the checklist: scope ambiguity, capability fit, timeline realism, data sensitivity, reputational/regulatory exposure, conflict signals. The [pre-mortem prompt](../prompts/safety-pre-mortem.md) may assist. Done when each item is cleared or flagged.
3. **⛔ CHECKPOINT: Go / no-go** — *Risk reviewer* reads intake and flags; decides proceed, proceed-with-conditions, or decline. Recorded with reasons. No plan drafting before this gate.
4. **Draft plan** — *Planning model* drafts from approved intake facts only: objectives, phased approach, roles, assumptions (labeled), open questions for the client. The [discovery-brief prompt](../prompts/strategy-discovery-brief.md) pattern applies. Done when the draft covers the template.
5. **Correct** — *Engagement owner* rewrites the draft into a real plan: corrects assumptions, applies pricing/terms per company practice (never model-invented), aligns with capacity. Done when the owner would defend every line.
6. **⛔ CHECKPOINT: Approval** — *Engagement owner* formally approves; anything conditioned at step 3 is verified as satisfied. Done when recorded.
7. **Send and log** — plan goes to the client; intake, risk record, and plan version are logged. Client feedback loops to step 5 revisions.
8. **Learn** — after the engagement starts (or the client declines), a short note: what intake missed, what risk check should have caught. Checklist and template revised.

**Text flow equivalent:** intake → risk check → (checkpoint: go/no-go) → draft plan → correct → (checkpoint: approval) → send and log → learn.

## Tools (replaceable categories)

- Intake capture: form tool or shared template.
- Risk checklist: document or checklist tool.
- Plan drafting: any text model with verified data-handling terms.
- Records: CRM or document store with versioning.

## Evidence captured

- Completed intake with unknowns marked.
- Risk check results and the go/no-go decision with reasons.
- AI draft vs. corrected plan (diff shows what the model got wrong — feeds step 8).
- Approval record and the version sent.

## Failure modes

- **Plan before gate** — drafting momentum bypasses the risk decision. Step order is the control; no step 4 artifacts may exist before step 3 is recorded.
- **Model-invented commitments** — the draft implies pricing, dates, or capabilities. Step 5 exists precisely for this; the diff makes it auditable.
- **Optimistic intake** — unknowns filled with hopeful guesses. The template's explicit "unknown" marking is the counter; risk reviewer treats unmarked certainty skeptically.
- **Stale risk checklist** — never updated after misses. Step 8 exists precisely for this.

## Rollback and recovery

- Before step 7, everything is internal: revise or abandon freely; a declined intake is archived, not deleted (it's evidence).
- After sending: corrections go to the client as explicit revisions ("v2 replaces v1"), never silent edits. If the engagement was accepted on a flawed plan, the engagement owner leads renegotiation honestly.

## Privacy considerations

Client requests contain confidential business information and personal data. Do not paste client material into AI tools without verified retention/training terms and, where promised or required, client consent. Strip personal data not needed for planning. Access to intake records limited to those involved.

## Success measures

- Zero engagements begun without a recorded go/no-go and approval.
- Step 5 correction volume trending down (drafting improving).
- Post-engagement surprises that intake "should have caught" trending down.
