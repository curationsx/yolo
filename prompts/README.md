# Prompts

Standalone, metadata-rich prompts for Human × AI work. Each file is a complete artifact: copy the **Prompt text** into your AI tool, supply the required inputs, and review the output as specified.

## Conventions

- Filenames: `<category>-<slug>.md`, lowercase, hyphenated.
- Categories: `strategy`, `research`, `operations`, `creative`, `engineering`, `safety`, `decision`, `retrospective`.
- Every prompt begins with YAML front matter matching [schemas/prompt.schema.json](../schemas/prompt.schema.json), then the required sections in order.
- Examples use fictional, non-sensitive data only.
- Prompts are model-agnostic; no compatibility claims without recorded tests.
- Lifecycle and status rules: see [PLAYBOOK.md](../PLAYBOOK.md) and [docs/QUALITY.md](../docs/QUALITY.md).

## Metadata contract (front matter)

```yaml
---
id: rubber-duck-debugging          # unique slug, matches filename after category prefix
title: Rubber-Duck Debugging Partner
category: engineering              # one of the categories above
version: 0.1.0                     # semver; see PLAYBOOK.md for bump rules
status: draft                      # draft | tested | stable | retired
license: MIT                       # license of the prompt text itself
tags: [debugging, reasoning]
---
```

## Required sections (in order)

1. **Purpose and non-goals** — what it's for, and explicitly what it is not for.
2. **Required inputs** — what the user must supply; the prompt asks rather than guesses when these are missing.
3. **Prompt text** — the copyable prompt, in a fenced block.
4. **Expected output contract** — the structure and properties output must have.
5. **Limitations and failure modes** — honest, observed or anticipated.
6. **Human review requirements** — what a human must check before using output.
7. **Privacy and data handling** — what not to paste in; sanitization guidance.
8. **Evaluation checks** — how to tell whether a run succeeded.
9. **Example usage** — fictional input and a sketch of conforming output.

## Current prompts

Run `python tools/yolo.py list prompts` for the live index, or browse:

| Prompt | Category | Purpose |
| --- | --- | --- |
| [strategy-discovery-brief.md](strategy-discovery-brief.md) | strategy | Turn a fuzzy initiative into a structured discovery brief |
| [research-source-synthesis.md](research-source-synthesis.md) | research | Synthesize multiple sources with attribution and confidence labels |
| [operations-sop-drafting.md](operations-sop-drafting.md) | operations | Draft a standard operating procedure from a rough process description |
| [creative-constructive-critique.md](creative-constructive-critique.md) | creative | Structured, kind, specific critique of a draft |
| [engineering-rubber-duck-debugging.md](engineering-rubber-duck-debugging.md) | engineering | A questioning debugging companion that never guesses your bug for you |
| [safety-pre-mortem.md](safety-pre-mortem.md) | safety | Imagine the plan already failed; work backward to causes and mitigations |
| [decision-memo.md](decision-memo.md) | decision | Draft a decision memo with options, trade-offs, and a clear recommendation |
| [retrospective-learning-review.md](retrospective-learning-review.md) | retrospective | Facilitate a blameless learning review from raw notes |

## Contributing a prompt

Follow the lifecycle in [PLAYBOOK.md](../PLAYBOOK.md), validate with `python tools/yolo.py doctor`, and open a PR. See [CONTRIBUTING.md](../CONTRIBUTING.md).
