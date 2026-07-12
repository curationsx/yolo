# Quality Model

How we judge artifacts in this repository — the ladder for the project overall, and the rubric for individual artifacts.

## The ladder

| Tier | What it means | Signals |
| --- | --- | --- |
| **Good** | Clear purpose, navigable docs, useful starter artifacts, healthy repo basics | A newcomer finds and uses one artifact within minutes |
| **Great** | Consistent schemas, tested examples, contribution pathways, reusable workflows, explicit human checkpoints | Artifacts validate against schemas; contributors know exactly how to add one |
| **Amazing** | An executable knowledge system: machine-readable catalog, validation, discovery, transparent rubric, release discipline | `python tools/yolo.py doctor` passes; discovery works offline; changes follow the playbook lifecycle |
| **Top 0.1%** | Unusual trust and taste: onboarding, provenance, evaluation, accessibility, safety, editorial curation, low-friction extension, a signature experience people remember | People cite artifacts from here in their own work and come back to contribute |

We claim tiers only when the signals are demonstrable. Current honest position: the **Good** and **Great** signals ship in the foundation; **Amazing** machinery (CLI, schemas, taxonomy) exists and deepens with use; **Top 0.1%** is a direction, not a status.

## Artifact scoring rubric

Score each artifact 0–2 on each dimension (0 = absent, 1 = present, 2 = exemplary). Maximum 12.

| Dimension | Question |
| --- | --- |
| **Clarity** | Can a newcomer use it without asking anyone? |
| **Completeness** | Are all required sections present and substantive (per [prompts/README.md](../prompts/README.md) or [workflows/README.md](../workflows/README.md))? |
| **Accountability** | Are human checkpoints and review requirements explicit? |
| **Safety & privacy** | Are data handling, limitations, and failure modes honestly documented? |
| **Evidence** | Does it specify what to capture so results can be audited? |
| **Reusability** | Is it vendor-neutral, parameterized, and versioned? |

Interpretation: **10–12** exemplary, feature it. **7–9** solid, merge it. **4–6** needs revision before merge. **0–3** back to draft.

Reviewers include the score (or the dimensions that fall short) in review comments. Scores are advisory judgment aids, not gates wielded mechanically.

## Status labels

Every prompt and workflow carries a `status` field:

- `draft` — usable but unproven; expect rough edges.
- `tested` — used in real work at least once with the example inputs; output contract held.
- `stable` — used repeatedly, revised from feedback, no known sharp edges.
- `retired` — kept for the record; superseded or no longer recommended.

Never label an artifact above what you can evidence.
