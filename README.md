# CurationsX YOLO

**Your Operations, Leverage, and Orchestration** — a practical, open playbook for accountable **Human × AI** work.

> Early foundation under active curation. No adoption claims, no hype — just artifacts you can read, run, and reuse.

## What is this?

- **CurationsX** explores and publishes practical patterns for Human × AI work: prompts, workflows, tooling notes, and the thinking behind them.
- **AoT — Artificial of Things** is the connective practice of composing *people, context, models, tools, evidence, controls, and feedback* into useful systems. Not a product. A discipline.
- **YOLO** here means *Your Operations, Leverage, and Orchestration*: ambitious experimentation with explicit review, recovery, and accountability — not reckless automation.

The governing product contract for `curations.dev` is the
[Project Evidence Registry PRD](docs/PRD-project-evidence-registry.md): builders
voluntarily submit their own public repository and PRD; Curations publishes
exactly what they declared and what deterministic checks observed at a dated
commit, then offers optional, human-controlled guidance.

🦆 A rubber duck appears throughout as our thinking companion: explain it to the duck before you ship it.

## Who is this for?

People who use AI in real work — operators, researchers, engineers, writers, consultants — and want repeatable, reviewable, recoverable ways to do it. The problem it solves: most AI usage is improvised and unaccountable. This repository gives you tested starting points with human checkpoints built in.

## The AoT loop

```
Intent → Context → Compose → Act → Verify → Learn
   ↑                                            │
   └────────────────────────────────────────────┘
```

1. **Intent** — a human states the goal and the boundaries.
2. **Context** — gather the facts, constraints, and sources that matter.
3. **Compose** — pick prompts, tools, and workflow steps that fit.
4. **Act** — run the work, human and AI together.
5. **Verify** — a human checks evidence against the intent.
6. **Learn** — capture what worked, revise the artifact, repeat.

Read the full treatment in [docs/AOT.md](docs/AOT.md).

## Five-minute quick start

1. Clone this repository.
2. Run the local CLI (Python 3.9+, standard library only, no network, no telemetry):

   ```bash
   python tools/yolo.py doctor          # verify the repository is healthy
   python tools/yolo.py list prompts    # see all prompts
   python tools/yolo.py show rubber-duck-debugging
   ```

3. Open [prompts/engineering-rubber-duck-debugging.md](prompts/engineering-rubber-duck-debugging.md), copy the prompt text into your AI tool of choice, and paste in a bug you're stuck on.
4. Then try a workflow: [workflows/research-synthesis-review-publication.md](workflows/research-synthesis-review-publication.md) walks a research task from question to published, human-reviewed output.

## Navigate

| Where | What |
| --- | --- |
| [docs/START-HERE.md](docs/START-HERE.md) | Guided onboarding path |
| [MANIFESTO.md](MANIFESTO.md) | Human × AI principles we hold ourselves to |
| [PLAYBOOK.md](PLAYBOOK.md) | The prompt lifecycle: draft → test → release → retire |
| [prompts/](prompts/) | Standalone, metadata-rich prompts you can use today |
| [workflows/](workflows/) | Human × AI workflows with explicit checkpoints and rollback |
| [software/](software/) | Curated, job-to-be-done tool directory with a neutral rubric |
| [community/](community/) | GitHub Discussions blueprint, agent protocol, PRD showcase, and resource exchange |
| [taxonomy/](taxonomy/) | The machine-readable AoT taxonomy |
| [schemas/](schemas/) | JSON Schemas that validate prompts, workflows, and software entries |
| [docs/AOT.md](docs/AOT.md) | AoT explained with examples and anti-patterns |
| [docs/QUALITY.md](docs/QUALITY.md) | Quality ladder and scoring rubric |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Shared vocabulary |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Now / Next / Later |
| [docs/PRD-project-evidence-registry.md](docs/PRD-project-evidence-registry.md) | **Governing CURATIONS.DEV product PRD** — Project-centered, evidence-led, opt-in |
| [docs/PRD-community-discussion-board.md](docs/PRD-community-discussion-board.md) | Community Discussion Board PRD — activation, forms, distillation pipeline |
| [docs/PRD-aot-agent-protocol.md](docs/PRD-aot-agent-protocol.md) | AoT Agent Protocol PRD — opt-in, read-only, bounded-spend agent protocol |
| [docs/PRD-azure-foundry-integration.md](docs/PRD-azure-foundry-integration.md) | Azure Foundry Integration PRD — design gated behind the sim emulator |
| [docs/PRD-catalog-surface.md](docs/PRD-catalog-surface.md) | Catalog Surface PRD — browsable catalog from `catalog.json` |
| [foundry-sim/](foundry-sim/) | Local offline simulator — zero-cost Azure Foundry emulation, no network calls |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

## What makes this good, great, amazing, top 0.1%?

An honest quality model — where we are and where we're headed (details in [docs/QUALITY.md](docs/QUALITY.md)):

- **Good** — clear purpose, navigable docs, useful starter artifacts, healthy repo basics. *This PR aims here and beyond.*
- **Great** — consistent schemas, tested examples, contribution pathways, explicit human checkpoints. *Schemas and checkpoints ship now; community pathways are documented and await activation.*
- **Amazing** — an executable knowledge system: machine-readable taxonomy, a validating CLI, transparent rubric. *The CLI and taxonomy ship now; depth grows with use.*
- **Top 0.1%** — unusual trust and taste: provenance, evaluation, accessibility, strong curation, a signature experience people remember. *The roadmap, not a claim.*

## Status

Early-stage. Everything here is versioned, reviewable, and honestly labeled. If something says `draft`, treat it as a draft.
