# Start Here

Welcome. This page gets you from "just cloned" to "using this in real work" in one sitting.

## 1. Orient (2 minutes)

Read the [README](../README.md). You need three ideas:

- **AoT** — composing people, context, models, tools, evidence, controls, and feedback into useful systems.
- **YOLO** — Your Operations, Leverage, and Orchestration: ambition *with* accountability.
- **The loop** — Intent → Context → Compose → Act → Verify → Learn.

## 2. Verify your copy (1 minute)

```bash
python tools/yolo.py doctor
```

This checks that the repository's prompts, workflows, taxonomy, and software entries are internally consistent. It needs only Python 3.9+ and the standard library — no installs, no network, no telemetry.

## 3. Use one prompt (5 minutes)

```bash
python tools/yolo.py list prompts
python tools/yolo.py show rubber-duck-debugging
```

Pick the prompt that matches a task you actually have today. Copy the **Prompt text** section into your AI tool, fill in the required inputs, and note the **Human review requirements** before you use the output.

## 4. Run one workflow (an afternoon)

Open [workflows/](../workflows/) and pick the one closest to your work. Each workflow tells you the actors, inputs, steps, human checkpoints, evidence to capture, and how to roll back. Follow it end to end once before adapting it.

## 5. Go deeper

| If you want to… | Read |
| --- | --- |
| Understand the philosophy | [MANIFESTO.md](../MANIFESTO.md) |
| Understand AoT properly | [AOT.md](AOT.md) |
| Write your own prompt | [PLAYBOOK.md](../PLAYBOOK.md) + [prompts/README.md](../prompts/README.md) |
| Write your own workflow | [workflows/README.md](../workflows/README.md) |
| Explore the proposed prompt lab, workflow clinic, and PRD showcase | [community/README.md](../community/README.md) |
| Propose a tool | [software/SUBMIT.md](../software/SUBMIT.md) |
| Contribute anything | [CONTRIBUTING.md](../CONTRIBUTING.md) |

## A note on the duck 🦆

Before you ship AI-assisted work, explain it out loud — to a colleague, or to a rubber duck. If you can't explain what the AI did and why you trust it, you're not done verifying.
