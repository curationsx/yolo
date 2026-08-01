# Discovery Log: The PRD Audit Golden Standard

**Date:** 2026-07-20
**Phase:** Bronze Lane (Ideation & Discovery)
**Authors:** Wyatt & Frank (Executive/Ogilvy Persona) + Watchdog Ducky

## Executive Summary
This document captures the real-time architectural pivot from a basic "Hygiene Check" (a punitive linting task) to a high-value "Workflow Validation & Skill Discovery" engine. We are defining the "Lighthouse for PRDs"—a zero-fluff, brutalist auditing framework for the Vibe Coding community.

## The Problem
Our initial concept relied on "Community" as a core auditing metric. We realized this fails universally. A highly sensitive medical pipeline or a forensic cold-case tracking tool should *not* score high on "Community." We needed universal pillars that evaluate a PRD equally well for a 19-year-old building a weekend recipe app and a Principal Engineer building Enterprise SaaS.

## The NotebookLM Synthesis
We fed the history of requirements engineering (Waterfall -> Agile -> Vibe Coding) into NotebookLM to extract the underlying engineering truths of a flawless PRD. 

The academic outcome was:
1. **Viability** (Market Moat)
2. **Execution** (Technical Steering)
3. **Resilience** (Failure Determinism)
4. **Constraint Governance and Context Coverage (CGCC)** (Agentic Containment)

## The "Ogilvy" UX Translation (Work in Progress)
The academic terms are too heavy for a Vibe Coding dashboard. We are currently iterating on humanistic, 1-2 word UI labels that communicate high-stakes engineering truths without corporate jargon. 

**Current Explorations & Late-Night "Wyattisms":**
- **Safety:** A mandatory inclusion. It signals "Digital Stewardship" in the AoT (AI of Things) era. It evaluates Privacy-by-design and agentic containment. It is the enterprise-grade moat.
- **Mapping / Organization:** Humans are messy. Does the PRD have logical flow so the UI/UX can talk to the backend?
- **Blueprint:** Highly resonant term for the technical execution plan.
- **Delivery:** A gut-feeling metric. (Perhaps evaluating if the PRD actually leads to a shippable state).
- **Human × AI (Human in the Loop):** Auditing the actual delegation. Who does what? Are skills properly assigned?
- **AI Readability / Awareness:** How easily can an LLM ingest this PRD without hallucinating?

## Next Steps
We are pausing to sleep on these concepts. The goal is not to force a rigid 4-pillar structure if 5 or 6 pillars serve the human and the AI better. We will refine these concepts (Safety, Blueprint, AI Readability, etc.) into the final `prd-audit.schema.json` upon resuming the session.

---

## Morning Session: 2026-07-22 - Corpus Research & Systemic Design

### Wyatt's Core Observations

**On Data Sources:**
- Reverse engineer public GitHub repos as the training corpus
- Source by: Stars, Recently Updated, Tech Stack presence, SKILLS.md (present vs absent), AI/LLM workflow mentions (present vs absent)
- Academic literature: arxiv.org, Google Scholar on GitHub repo ecosystems

**On Conditional Audits:**
- Not every repo needs SEO/AI Discovery. A private internal tool, an administrative CLI, a single React component — these must not be penalized on irrelevant metrics
- Our agents must understand *when* a bucket applies vs when it would actively harm the end-user's audit score unfairly

**On The Spectrum:**
- Meh → OK → Good → Great → Amazing → Moonshot
- Must apply to Human x AI workflows AND pure-code repos

**⚠️ CRITICAL: Agent Legal/Moral Protocol**
- What happens when an agent encounters illegal content in a public repo?
- What happens when an agent encounters accidentally-public private data (medical records)?
- Agents must disengage cleanly, avoid hallucination about content, and protect CURATIONS from third-party liability
- No association. No continuation. No flagging that could trigger LLM monitoring red alerts on our infrastructure

**On The Moat:**
- There is NO live product that aggregates public repo data through boolean matrices, categorical libraries, and AI Communication layers to identify PRD gaps
- We surface things builders cannot see from inside their own repo
- The Product = Real-time cross-repo intelligence + individual progress tracking

**On Two End-User Types:**
1. The GitHub SSO submitter: Wants progress tracking, skill discovery, personal audit history
2. The anonymous observer: No GitHub, no submission. Wants to see what people are building, what stacks are popular, what categories are trending

### Open Research Questions (For NotebookLM)
- Is there existing academic measurement of "Human x AI workflow quality" in software engineering?
- What are the established GitHub ecosystem metrics researchers use to measure repo health?
- What is the current state of adversarial content detection in public code repositories?
- Does any existing framework address conditional audit scoring (i.e., skipping irrelevant categories)?

---

## Resolution: 2026-08-01 - the pillars, decided

**Phase:** Bronze -> Silver (the concepts became a contract)
**Artifact:** `schemas/prd-audit.schema.json` v0.1.0, with contract tests at
`scripts/audit/tests/test_prd_audit_schema.py`

The session above ended with "we are pausing to sleep on these concepts." This
is what we woke up with. Six pillars, not four, because the note explicitly
allowed 5 or 6 if they serve the human and the AI better, and they do.

| Pillar | The question a builder actually asks | Applies |
|---|---|---|
| **VIABILITY** | Is there a reason for this to exist, and does anything protect it? | Conditional |
| **BLUEPRINT** | Can an agent build this without guessing? | Always |
| **RESILIENCE** | What happens when it breaks? | Always |
| **SAFETY** | What may an agent touch, and what must it never touch? | Always |
| **DELEGATION** | Human x AI: who decides, who executes, who reviews? | Conditional |
| **LEGIBILITY** | Can a model read this without hallucinating? | Always |

### How the academic four map onto the human six

- Viability survived unchanged. It was already a builder's word.
- Execution / Technical Steering became **Blueprint**, which the session flagged
  as "highly resonant."
- Failure Determinism became **Resilience**, unchanged.
- Constraint Governance and Context Coverage became **Safety**. This was the
  right call for the reason the session gave: it signals digital stewardship,
  and it is the enterprise-grade moat. Nobody will ever type "CGCC" into a
  search bar.
- Human x AI became **Delegation**, because the pillar is not about whether you
  use AI, it is about whether the handoff is written down.
- AI Readability became **Legibility**, one word, and it is the pillar most
  invisible from inside your own repository.

### Two Wyattisms that did not become pillars, and why

- **Mapping / Organization** is real but it is not separable. Logical flow is
  measured by Blueprint (can an agent follow it) and by Legibility (can a model
  parse it). A third pillar would have double-counted the same evidence.
- **Delivery** was described in the session as "a gut-feeling metric." We did
  not ship it. Every pillar in this contract must be reconstructible from
  findings that cite an artifact the builder can open. A gut feeling cannot cite
  anything, and a score nobody can dispute is not a score, it is an assertion.
  If Delivery returns, it returns with evidence.

### The decision that mattered most: Community is not a pillar

The session's own critique was correct and we followed it all the way. A
sensitive medical pipeline and a forensic cold-case tool must not be scored on
community. Community now lives in a non-scoring `comparison` object that carries
cross-repository context and **cannot move the composite**. This also keeps the
roadmap's promise not to rank projects as "best" from counts or votes.

Note that the audit landing page mock still shipped a COMMUNITY score card until
today. The page and the schema now agree.

### Conditional scoring, enforced rather than requested

The morning session asked that agents understand when a bucket applies versus
when scoring it would unfairly harm the builder. That is now structural, not a
matter of agent judgement:

- A pillar marked `not_applicable` **cannot carry a score**. The schema rejects
  the document.
- It **must** carry a rationale addressed to the builder.
- The composite is averaged only over applicable pillars, and the report must
  publish `pillars_scored` and `pillars_excluded` so a reader can rebuild the
  arithmetic and dispute the exclusions rather than trust the number.

An internal admin CLI is not punished for having no market. A human-authored
repository is not punished for having no agent workflow.

### The spectrum, made deterministic

Meh -> OK -> Good -> Great -> Amazing -> Moonshot is now a fixed mapping over
0-100: meh 0-39, ok 40-54, good 55-69, great 70-84, amazing 85-94, moonshot
95-100. A band is therefore never a matter of opinion, and Moonshot is rare by
construction.

### The legal and moral protocol, encoded so it cannot be softened

The session raised the hardest question: what happens when an agent meets
illegal content, or medical records somebody made public by accident. The answer
is now enforced by the shape of the data, not by asking an agent nicely.

A report may record a `disengagement` object containing exactly two fields: a
reason code from a closed vocabulary, and a timestamp. There is no `detail`,
`excerpt`, `description`, `path`, `severity`, or `notes` field, and
`additionalProperties` is `false`. It is structurally impossible for a
CURATIONS report to describe, quote, locate, or flag what was seen. When
disengagement is present the composite and the comparison must both be null:
stopping means stopping.

This is "no association, no continuation, no flagging" expressed as a schema
rather than as a policy that a future well-meaning patch could erode. The
contract tests assert it by attempting eight different leak fields and requiring
every one to be rejected.

### Still open

- Ruleset 0.1.0 defines the shape, not the checks. Which deterministic Tier A
  checks feed each pillar is the next piece of work.
- The corpus research in Issue #82 should inform the Blueprint and Legibility
  check sets, since those are the two pillars where cross-repo evidence is
  strongest.
- `docs/QUALITY.md` and the public methodology page should absorb the band
  thresholds once the check sets exist, so the rubric is public before any real
  repository is scored.
