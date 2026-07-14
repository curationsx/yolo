# Cookbooks

Cookbooks are curated, stack-aware handoff revisions built from the standalone
prompt artifacts in [`prompts/`](../prompts/). The cookbook revision and source
prompt version are intentionally separate: a tailoring can evolve without
pretending the underlying prompt has reached a maturity level it has not earned.

`entries.json` is the inventory consumed by CURATIONS.DEV. Each entry:

- maps to one schema-validated prompt source;
- declares its own semver revision and release status;
- covers all six supported stacks exactly once across `strong_fit` and
  `partial_fit`;
- remains advisory until a human moves the handoff into their own Copilot CLI.

CURATIONSX agents may discuss the cookbook and provide disclosed fit checks on
the public stack boards. They do not execute, build, deploy, or spend on behalf
of an end user. Terminal execution belongs to the user's own account,
permissions, repository, and billing.

Validate with:

```bash
python tools/yolo.py doctor
python tools/yolo.py list cookbooks
```
