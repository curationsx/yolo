# Roadmap

Now / Next / Later. No dates, no promises — direction, honestly stated. Items move only when someone does the work.

## Now (in this foundation)

- Front door: README, START-HERE, manifesto, AoT explainer, quality model, glossary.
- Prompt playbook and an initial set of eight prompts with consistent metadata.
- Five workflows with actors, checkpoints, evidence, and rollback.
- Curated software directory with a neutral rubric and submission path.
- Versioned machine-readable taxonomy and JSON Schemas for prompts, workflows, and software entries.
- Standard-library CLI: `doctor`, `list`, `search`, `show`, `catalog` — offline, no telemetry.
- Contribution guide.
- Proposed Community Grid with discussion forms, PRD showcase, resource exchange, and a vendor-neutral agent protocol.
- Full PRD suite: [Community Discussion Board](PRD-community-discussion-board.md), [AoT Agent Protocol](PRD-aot-agent-protocol.md), [Azure Foundry Integration](PRD-azure-foundry-integration.md), [Catalog Surface](PRD-catalog-surface.md).
- Local offline Foundry emulator (`foundry-sim/`) — zero-cost, no network, standard-library-only staging layer for evaluating personas, workflows, and ROI before connecting real Azure keys.
- Published Astro catalog and Board surface at `curations.dev`.
- Versioned Cookbooks with two user-funded lanes: **Use My Copilot** and **Run in My Terminal**. No silent CURATIONS-funded inference fallback.

## Next (as the community forms)

- First externally contributed prompt and workflow merged under the stewardship process.
- Promote initial artifacts from `draft` to `tested` by using them in real work and recording outcomes.
- Guardrail registry and stewardship charter from the [Digital Stewardship PRD](PRD-digital-stewardship.md).
- CI that runs `python tools/yolo.py doctor` on pull requests.
- Prompt evaluation notes: lightweight before/after records when prompts are revised.
- Expand the software directory using [software/SUBMIT.md](../software/SUBMIT.md) submissions.
- Enable and manually exercise the [Community Grid](../community/README.md); name initial human stewards before deploying any agent (see [Community Discussion Board PRD](PRD-community-discussion-board.md)).
- Evaluate a read-only agent on public fictional fixtures via `foundry-sim/` before any community pilot (see [AoT Agent Protocol PRD](PRD-aot-agent-protocol.md)).
- Build out personas and workflows in `foundry-sim/personas/` and `foundry-sim/workflows/` to validate ROI before connecting to real Azure (maintainer-owned).
- Migrate embedded Copilot delegation from the shared OAuth App to a GitHub App if finer permissions or shorter-lived user tokens materially improve the trust boundary.

## Later (earned, not scheduled)

- Connect real Azure AI Foundry (first-party Azure OpenAI only; see [Azure Foundry Integration PRD](PRD-azure-foundry-integration.md) — gated behind sim validation and Startup Credits guardrails).
- CURATIONS Credits: an explicit hosted-execution product with purchased usage, visible limits, and no connection to a visitor's GitHub Copilot entitlement.
- Worked case studies of workflows applied end-to-end, with evidence.
- Taxonomy v2 informed by real usage, with migration notes.
- Accessibility review of all artifacts against a documented checklist.
- Localization of core documents if contributors materialize for it.
- Signature experience refinements based on what users actually reach for.
- Evidence-backed discussion-to-artifact distillation and progressively expanded agent capabilities, only after the prior permission tier is proven.

## What we will not do

- Spend CURATIONS model credits for a user who selected **Use My Copilot** or **Run in My Terminal**.
- Collect telemetry of any kind.
- Publish fake badges, invented testimonials, or adoption claims we can't evidence.
- Lock any workflow to a specific vendor.
- Treat enterprise AI capacity as permission for unbounded or invisible agent usage.
