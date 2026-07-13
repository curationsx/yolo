# CURATIONSX: A Human × AI Community Platform
**Handoff brief for Claude Design · curationsx/yolo · 2026-07-12**
> Note: All Digital Stewardship references removed per maintainer instruction (that conversation was an error).

---

## 1. Repository State (current `main`)

Merged foundation (PRs #1–#3):
- **Flagship repo structure** — README, MANIFESTO (10 Human × AI principles), AoT loop docs (Intent → Context → Compose → Act → Verify → Learn), quality ladder (good → great → amazing → top 0.1%), glossary, roadmap.
- **Prompt playbook** — 8 prompts across strategy/research/ops/creative/engineering/safety/decision/retro, all schema-validated.
- **Workflows (5)** — with human checkpoints, rollback, privacy, evidence capture.
- **Community Grid** — 4 GitHub Discussion forms (prompt-lab, workflow-clinic, prd-showcase, resource-exchange), vendor-neutral agent protocol (AGENTS.md).
- **Software curation** — 12 open-source tools, neutral rubric, `entries.json`, submission path.
- **`tools/yolo.py`** — stdlib-only CLI: doctor, list, search, show, catalog. 31 tests green.
- **`foundry-sim/`** — zero-cost offline Azure AI Foundry emulator + idempotent `install.sh` bootstrap.

## 2. Outstanding PRs — Updated Descriptions

### PR #4 — `feat(agent): AoT protocol runner — first live invocation (M6)`
Implements the AoT agent protocol as a working, guarded runner and completes the first live pilot against real `gpt-5.4-mini`.
- `foundry-sim/agent.py`: explicit-invocation CLI, persona prompts, depth tiers (512/1,024/2,048 output tokens), hard limits enforced pre-send (10 req/run, $0.10/run).
- §6.5 response contract: disclosure header, labeled AI elements, human-decision footer with named owner.
- `AGENT-IDENTITY-CARD.md` versioned in-repo; first production persona (`steward.json`, read-only, decision-deferring).
- 7 new offline tests (31 total). No credentials in diff; CI never runs azure mode.
- **Relevance to platform PRD:** this is the persona-agent trust layer — disclosure, spend caps, and human-decision ownership carry directly into community-facing agent personas.

### PR #5 — `feat(curations.dev): catalog site + persona agents + engagement feed`
The curations.dev pilot — the seed of the community platform.
- **Astro 7 site** (17 static pages, brutalist v1.1 tokens); landing pages for pilot pair **Cloudflare** + **Supabase** with workflow-stage snapshots and doc links.
- **Two-lane engage panel:** PRD fit check + community share; public feed rendered client-side, AI always labeled.
- **Agent gateway** (Cloudflare Worker): Azure OpenAI `gpt-5.4-mini`, 512-token cap, 10/day per IP, 200/day global kill-switch (KV); personas grounded in each company's public GitHub docs.
- **Feed store:** Azure Cosmos DB serverless, pay-per-request.
- Live: https://curations-dev.pages.dev · gateway health endpoint verified.
- **Relevance to platform PRD:** this IS v0 of the platform — landing pages per company, engagement feed, disclosed agents. The PRD below extends it.

## 3. PRD Goal: CURATIONSX Community Platform (Astro package)

**Purpose:** Community engagement through Human × AI interaction, showcasing open-source tech stacks.

### Core experience
1. **Landing page — list view** of featured content cards, one per open-source software company. Upvote control bottom-right of each card.
2. **Company landing pages** (from card click) host a **Lobsters-style discussion board** where Humans and AI Agent Personas interact:
   - Humans share favorite prompts and how they use the stack.
   - Agent Personas answer end-user queries ("How can I use this?", "Will this stack solve XYZ?") and participate in threads — always disclosed.
3. **Universal search agent** — helps end-users find where to start on their PRD, suggests PRD-curation ideas and best-fit tech stacks; results backlink to company landing pages.
4. **Universal engagement feed** — cross-site activity stream; upvote best prompts and stack-integration ideas.
5. **Agent-maintained knowledge wikis** per company, built from official open-source knowledge decks in GitHub repos.
6. **Auth:** GitHub SSO.

### Building blocks already in place
| Platform need | Existing asset |
|---|---|
| Company cards / catalog | `software/entries.json`, `catalog.json`, PRD-catalog-surface.md, PR #5 site |
| Agent personas + trust rules | PR #4 runner, AGENT-IDENTITY-CARD, AGENTS.md protocol |
| Engagement feed | PR #5 Cosmos feed + two-lane engage panel |
| Cost guardrails | mini-tier guard, per-IP/global caps, spend limits |
| Community structures | Discussion templates, moderation compact, distillation pipeline |

## 4. Quality Ladder

**Good** — honest AI disclosure on every agent contribution; human-decision ownership; real utility; zero-cost-first architecture.

**Great** — Lobsters-grade discussion quality (invite trees, transparent moderation logs, tag-based threading per stack); agent personas grounded exclusively in official repo docs with citations/backlinks; upvote signal feeding the distillation pipeline.

**Amazing** — universal search agent turning "I have an idea" into a scaffolded PRD draft with recommended stack; Human × AI co-authored wikis with human merge approval — the AoT loop as a visible product feature; reputation spanning species (human karma, agent trust scores).

**Moonshot — Top 0.1%** — the reference implementation of accountable Human × AI community: every agent action auditable, reversible, spend-bounded, disclosed. Companies officially staff their own verified persona — the canonical "talk to the stack" layer. PRD-to-production flywheel.

## 5. Ask for Claude Design
Curate **two design inspirations**: one from community-software canon (Lobste.rs / early Metafilter / Are.na) and one from editorial/brutalist product design. Translate into: card system for list view, discussion-thread typography, agent-vs-human visual disclosure language, and the universal feed. Constraint: extend the CURATIONS v1.1 brutalist token system.
