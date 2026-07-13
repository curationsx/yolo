# Propose a Tool

Tools enter the [software directory](README.md) through evidence, not promotion. Anyone may propose; entries are reviewed like any other artifact.

## Before you submit

1. Read the [inclusion and exclusion criteria](README.md#inclusion-criteria).
2. Check [entries.json](entries.json) — the tool may already be listed.
3. Confirm you can fill every field below with defensible, durable statements.

## Easiest path: the CURATIONS form

Go to **[curations.dev/submit](https://curations.dev/submit/)**. The guided form:

1. asks the same durable questions reviewers use,
2. validates the slug, URLs, and required language,
3. shows a CURATIONS card preview,
4. generates schema-compatible JSON, and
5. opens GitHub's fork/branch/pull-request flow with the new file prefilled.

The generated intake file lives at `software/submissions/<id>.json`. A maintainer
verifies the sources, folds an accepted entry into [entries.json](entries.json),
regenerates `catalog.json`, and removes the intake file before merge.

## Direct repository path

Experienced contributors may instead open a pull request that adds an entry
directly to [entries.json](entries.json), matching
[schemas/software-entry.schema.json](../schemas/software-entry.schema.json).
The CLI validates it with `python tools/yolo.py doctor`.

## Required fields

```json
{
  "id": "tool-slug",
  "name": "Tool Name",
  "entity_type": "tool | company | platform | project",
  "category": "research",
  "primary_use": "One sentence: the job this tool does.",
  "deployment": "local | self-hosted | cloud | hybrid",
  "notable_strength": "One durable, defensible strength.",
  "verify_before_use": "The trade-off or question a user should verify directly.",
  "reference": "https://official-site.example"
}
```

Categories: `research`, `model-access`, `automation`, `observability-evaluation`, `knowledge-data`, `development`, `design-content`, `community-documentation`.

## Optional trust fields

Encouraged where you can state them with confidence — leave out anything you can't defend:

```json
{
  "license": "open-source | source-available | open-weight | proprietary-free-tier | proprietary | mixed",
  "featured": false,
  "source_repository": "https://official-source-repo.example",
  "platforms": ["Linux", "macOS", "Windows", "Web", "iOS", "Android"],
  "last_reviewed": "2026-07-12",
  "review_status": "verified | needs-review",
  "tags": ["local-first", "self-hostable"]
}
```

The `license` buckets are deliberately coarse and **not interchangeable**:
*open-source* (OSI-style license), *source-available* (visible source,
restricted use — e.g. fair-code), *open-weight* (downloadable model weights,
possibly restricted license), *proprietary-free-tier*, *proprietary*, and
*mixed* (meaningfully different licenses across components). When in doubt,
use `mixed` and explain in the PR — or omit the field.

`featured` is maintained editorially. Community upvotes inform attention but do
not automatically make an entry featured.

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
