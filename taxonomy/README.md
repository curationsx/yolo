# AoT Taxonomy

The shared, versioned vocabulary for describing Human × AI systems. Artifacts in this repository (prompts, workflows, software entries) use these terms so they stay comparable and machine-readable.

- Machine-readable source of truth: [taxonomy.json](taxonomy.json) (versioned; current: see the `version` field).
- Human definitions and narrative: [docs/AOT.md](../docs/AOT.md) and [docs/GLOSSARY.md](../docs/GLOSSARY.md).
- Validated by `python tools/yolo.py doctor`.

## Structure

The taxonomy covers eleven dimensions of any AoT composition:

| Dimension | Question it answers | Example concepts |
| --- | --- | --- |
| `intent` | Why is this system running? | create, analyze, decide-support, transform, monitor, learn |
| `actors` | Who and what participates? | owner, reviewer, operator, contributor, ai-model, tool-agent |
| `inputs` | What goes in? | instruction, document, dataset, conversation, signal |
| `context` | What surrounds the task? | domain-knowledge, constraints, history, style-guide, environment |
| `models_tools` | What capabilities are composed? | text-model, retrieval, automation, storage, transport, evaluation-harness |
| `actions` | What gets done? | generate, summarize, classify, extract, route, execute, publish |
| `outputs` | What comes out? | draft, structured-record, decision-input, publication, log |
| `human_controls` | Where can a human steer or stop? | checkpoint, approval, limit, override, rollback, disclosure |
| `evidence_provenance` | How is it auditable? | source-list, version-history, run-record, review-record, attribution |
| `risks` | What can go wrong? | fabrication, privacy-leak, bias, over-automation, provenance-loss, drift |
| `feedback_learning` | How does it improve? | review-notes, metrics, retro, revision, retirement |

## Versioning

The taxonomy carries a semver `version`. Adding concepts bumps minor; renaming or removing concepts bumps major (with migration notes in the PR). Artifacts referencing removed concepts must be updated in the same PR.

## Using the taxonomy

- Prompt and workflow `tags` should prefer taxonomy concepts where one fits.
- Workflow sections map to dimensions: **Actors** → `actors`, **Evidence captured** → `evidence_provenance`, **Failure modes** → `risks`, and so on.
- Proposing a concept: PR against [taxonomy.json](taxonomy.json) with a one-line definition and at least one artifact that would use it. Concepts nobody uses don't get added.
