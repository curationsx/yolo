# Workflows

This directory holds workflow definitions for the foundry-sim emulator.

**The maintainer owns and builds out these workflows.** The examples here are clearly labeled as `EXAMPLE` stubs.

## What is a sim workflow?

A sim workflow is a multi-step sequence of `FoundryClient.chat()` calls, each potentially using a different persona, that together accomplish a structured Human × AI task. Workflows here mirror the AoT loop (Intent → Context → Compose → Act → Verify → Learn) and map to the `workflows/` artifacts in this repository.

## Schema

Each workflow is a JSON file with the following fields:

```json
{
  "id": "unique-lowercase-slug",
  "label": "Human-readable name",
  "description": "What this workflow accomplishes",
  "aot_phases": ["Intent", "Context", "Compose", "Act", "Verify", "Learn"],
  "steps": [
    {
      "step": 1,
      "phase": "Intent",
      "persona": "persona-id-or-null",
      "instruction": "The user or system message for this step",
      "human_checkpoint": true,
      "checkpoint_description": "What the human reviews before proceeding"
    }
  ],
  "notes": "Free-form maintainer notes"
}
```

## How to add a workflow

1. Copy `example-research-synthesis.json` to a new file.
2. Edit steps to match your workflow.
3. In your code, iterate over steps, call `client.chat()` with the persona's system prompt and the step instruction, and pause at each `human_checkpoint: true` step for human review.
4. Run `python foundry-sim/dash.py` to see the workflow reflected in the topology panel.

## Connecting to a real deployment

The same workflow JSON files can drive real Azure OpenAI calls when `FOUNDRY_MODE=azure` is enabled (see `docs/PRD-azure-foundry-integration.md`). The step definitions do not change.

## Files

| File | Description |
| --- | --- |
| `example-research-synthesis.json` | EXAMPLE — maps to the existing research-synthesis-review-publication workflow |
