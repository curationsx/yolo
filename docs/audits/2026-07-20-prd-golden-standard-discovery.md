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
