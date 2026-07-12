# Propose a Tool

Tools enter the [software directory](README.md) through evidence, not promotion. Anyone may propose; entries are reviewed like any other artifact.

## Before you submit

1. Read the [inclusion and exclusion criteria](README.md#inclusion-criteria).
2. Check [entries.json](entries.json) — the tool may already be listed.
3. Confirm you can fill every field below with defensible, durable statements.

## How to submit

Open a pull request that adds an entry to [entries.json](entries.json) (matching [schemas/software-entry.schema.json](../schemas/software-entry.schema.json) — the CLI validates it: `python tools/yolo.py doctor`) and, if the category section exists in [README.md](README.md), a one-line rendered summary there.

## Required fields

```json
{
  "id": "tool-slug",
  "name": "Tool Name",
  "category": "research",
  "primary_use": "One sentence: the job this tool does.",
  "deployment": "local | self-hosted | cloud | hybrid",
  "notable_strength": "One durable, defensible strength.",
  "verify_before_use": "The trade-off or question a user should verify directly.",
  "reference": "https://official-site.example"
}
```

Categories: `research`, `model-access`, `automation`, `observability-evaluation`, `knowledge-data`, `development`, `design-content`, `community-documentation`.

## Required in the PR description

- **Evidence of the job**: how you (or a documented case) actually use this tool in a Human × AI workflow. "It's popular" is not evidence.
- **Affiliation disclosure**: state plainly if you work for, are paid by, or otherwise benefit from the vendor. Affiliation doesn't disqualify — hiding it does.
- **Durability check**: confirm the entry contains no pricing, no feature inventory likely to change within a year, and no superlatives ("best", "fastest") you can't support.

## What reviewers check

- Fields are durable and defensible; the reference URL is the official one.
- The `verify_before_use` field asks a genuinely useful question, not a token one.
- No promotional tone; the entry reads the same whether or not you love the tool.
- Schema validation passes (`python tools/yolo.py doctor`).

## Corrections and removals

Stale or misleading entry? Open a PR or issue with the evidence. Removal on evidence is a normal, unremarkable event — the directory's value is its trustworthiness, not its size.
