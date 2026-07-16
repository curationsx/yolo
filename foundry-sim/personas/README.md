# Personas

This directory holds persona definitions for use with the foundry-sim emulator.

**The maintainer owns and builds out these personas.** The examples here are clearly labeled as `EXAMPLE` stubs.

## What is a persona?

A persona is a named configuration that shapes how the simulator (and, eventually, a real Azure AI Foundry deployment) responds to requests. In `auto` mode the underlying model is determined by Copilot's routing; the persona adds context — a role, tone, scope, and set of constraints — that sits on top of whatever model is selected.

## Schema

Each persona is a JSON file with the following fields:

```json
{
  "id": "unique-lowercase-slug",
  "label": "Human-readable name",
  "description": "What this persona does and for whom",
  "system_prompt": "The system message prepended to every request using this persona",
  "scope": ["list", "of", "intended", "use", "cases"],
  "constraints": ["things this persona must not do"],
  "aot_elements": ["which AoT elements this persona primarily serves"],
  "notes": "Free-form maintainer notes"
}
```

All fields except `id` and `system_prompt` are optional but encouraged.

## How to add a persona

1. Copy `example-steward.json` to a new file (e.g., `my-persona.json`).
2. Edit the fields to match your use case.
3. In your code, pass the `system_prompt` as the first message with `"role": "system"` before your user messages.
4. Run `python foundry-sim/dash.py` to see the persona reflected in the topology panel.

## Connecting to a real deployment

When `FOUNDRY_MODE=azure` is enabled (see `docs/PRD-azure-foundry-integration.md`), the same persona files drive the system prompts sent to the real Azure OpenAI deployment. The interface does not change.

## Files

| File | Description |
| --- | --- |
| `example-steward.json` | EXAMPLE - a fictional community steward persona |
