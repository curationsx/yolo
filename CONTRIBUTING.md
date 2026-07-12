# Contributing

Thanks for helping build an accountable Human × AI commons. Contributions of every size are welcome — a typo fix, a usage note on a prompt, a new workflow, a tool proposal.

## Ground rules

- Everything follows the [MANIFESTO](MANIFESTO.md) and the [quality model](docs/QUALITY.md).
- Honest labels only: never set `status` above what your evidence supports.
- No sensitive data: examples use fictional people and organizations; evaluation evidence is sanitized before it lands in a public PR.
- Disclose AI assistance in your PR description when AI materially shaped the contribution. (Using AI is welcome here, of all places — hiding it isn't.)
- Disclose affiliations when proposing software entries ([software/SUBMIT.md](software/SUBMIT.md)).

## Before opening a PR

```bash
python tools/yolo.py doctor                  # must pass
python -m unittest discover tools/tests     # must pass if you touched tools/
python tools/yolo.py catalog                 # regenerate if you changed artifacts
```

## What to contribute, and how

| Contribution | Follow |
| --- | --- |
| New or revised prompt | [PLAYBOOK.md](PLAYBOOK.md) lifecycle + [prompts/README.md](prompts/README.md) format |
| New or revised workflow | [workflows/README.md](workflows/README.md) format and maturity model |
| Software entry | [software/SUBMIT.md](software/SUBMIT.md) |
| Taxonomy concept | [taxonomy/README.md](taxonomy/README.md) — include an artifact that uses it |
| Usage notes / evidence | Comment on or PR the artifact; real-world misses are gold |
| Docs and fixes | Plain PR |

## Review process

A maintainer (steward) reviews against the [rubric](docs/QUALITY.md). Expect specific, kind, quote-anchored feedback — the [constructive-critique prompt](prompts/creative-constructive-critique.md) sets the tone we aim for. Prompts and workflows get checked for realistic human review requirements and accurate privacy notes, not just formatting.

## Governance

Early-stage: decisions rest with maintainers, made in the open on PRs and issues. The stewardship model in [docs/PRD-digital-stewardship.md](docs/PRD-digital-stewardship.md) describes where governance is headed as the community grows.

## Questions

Open an issue. Explaining your question to the duck first is optional but traditional. 🦆
