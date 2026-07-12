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

## Next (as the community forms)

- First externally contributed prompt and workflow merged under the stewardship process.
- Promote initial artifacts from `draft` to `tested` by using them in real work and recording outcomes.
- Guardrail registry and stewardship charter from the [Digital Stewardship PRD](PRD-digital-stewardship.md).
- CI that runs `python tools/yolo.py doctor` on pull requests.
- Prompt evaluation notes: lightweight before/after records when prompts are revised.
- Expand the software directory using [software/SUBMIT.md](../software/SUBMIT.md) submissions.

## Later (earned, not scheduled)

- A published catalog surface generated from `catalog.json` for browsing without cloning.
- Worked case studies of workflows applied end-to-end, with evidence.
- Taxonomy v2 informed by real usage, with migration notes.
- Accessibility review of all artifacts against a documented checklist.
- Localization of core documents if contributors materialize for it.
- Signature experience refinements based on what users actually reach for.

## What we will not do

- Execute prompts against paid model APIs from this repository's tooling.
- Collect telemetry of any kind.
- Publish fake badges, invented testimonials, or adoption claims we can't evidence.
- Lock any workflow to a specific vendor.
