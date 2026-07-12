# Workflows

Composed, repeatable Human × AI processes. Each workflow instantiates the AoT loop (Intent → Context → Compose → Act → Verify → Learn) with explicit actors, checkpoints, evidence, and rollback.

## Format

Every workflow file begins with YAML front matter matching [schemas/workflow.schema.json](../schemas/workflow.schema.json):

```yaml
---
id: research-synthesis-review-publication
title: Research → Synthesis → Human Review → Publication
version: 0.1.0
status: draft            # draft | tested | stable | retired
maturity: foundation     # see maturity model below
license: MIT
tags: [research, publication]
---
```

Then the required sections, in order:

1. **Overview** — what the workflow accomplishes and when to use it.
2. **Actors** — human roles and AI/tool capabilities. Roles and categories, never vendors.
3. **Inputs and preconditions** — what must exist and be true before starting.
4. **Steps** — numbered; each names its actor and completion condition. Human checkpoints marked **⛔ CHECKPOINT**.
5. **Tools (replaceable categories)** — the kinds of tools used; any product name is an example, not a requirement.
6. **Evidence captured** — what artifacts the run produces for later audit.
7. **Failure modes** — what goes wrong and how you'd notice.
8. **Rollback and recovery** — how to stop, undo, or recover at each risky point.
9. **Privacy considerations** — data classes involved and handling rules.
10. **Success measures** — how you know a run (and the workflow) is working.

Diagrams are optional; when present (Mermaid), an accessible text equivalent must accompany them. The numbered steps are always the source of truth.

## Maturity model

| Maturity | Meaning |
| --- | --- |
| `foundation` | Designed from practice and principles; not yet executed end-to-end from this document |
| `exercised` | Executed end-to-end at least once; evidence recorded; rough edges documented |
| `proven` | Executed repeatedly by more than one team/person; revised from feedback |

Maturity describes execution history; `status` describes editorial lifecycle. A workflow can be `tested` (edited and reviewed) but still `foundation` (never run from the doc).

## Current workflows

Run `python tools/yolo.py list workflows` for the live index, or browse:

| Workflow | Purpose |
| --- | --- |
| [research-synthesis-review-publication.md](research-synthesis-review-publication.md) | From research question to published, human-reviewed output |
| [meeting-notes-decisions-tasks-approval.md](meeting-notes-decisions-tasks-approval.md) | From raw meeting notes to approved decisions and owned tasks |
| [prompt-change-evaluation-review-release.md](prompt-change-evaluation-review-release.md) | How prompt changes in this repo are evaluated, reviewed, and released |
| [client-intake-risk-check-draft-plan-approval.md](client-intake-risk-check-draft-plan-approval.md) | From client intake to a risk-checked, approved draft plan |
| [incident-triage-options-decision-learning.md](incident-triage-options-decision-learning.md) | From incident to triage, options, decision, and learning review |

## Contributing a workflow

Follow the format above, validate with `python tools/yolo.py doctor`, and open a PR. See [CONTRIBUTING.md](../CONTRIBUTING.md).
