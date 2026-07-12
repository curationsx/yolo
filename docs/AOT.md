# AoT — Artificial of Things

AoT is the connective practice of composing **people, context, models, tools, evidence, controls, and feedback** into useful systems.

The name is a deliberate echo of "Internet of Things." IoT connected devices; AoT connects *capabilities* — human judgment, model inference, tool execution, and organizational memory — into workflows that are more than the sum of their parts, and accountable at every joint.

## The seven elements

| Element | What it is | Guiding question |
| --- | --- | --- |
| **People** | The humans who set intent, review, and decide | Who owns this outcome? |
| **Context** | Facts, constraints, history, and sources relevant to the task | What does the system need to know? |
| **Models** | AI models used for generation, analysis, or transformation | What is delegated to inference, and why? |
| **Tools** | Software that retrieves, executes, stores, or transports | What acts on the world? |
| **Evidence** | Artifacts proving what happened: sources, drafts, diffs, logs | How would we audit this later? |
| **Controls** | Checkpoints, approvals, limits, and rollback paths | Where can a human stop or reverse this? |
| **Feedback** | Signals that improve the next run: reviews, metrics, retros | How does the system learn? |

## The loop

```
Intent → Context → Compose → Act → Verify → Learn → (back to Intent)
```

- **Intent.** A human states the goal, the boundaries, and what "done" means.
- **Context.** Gather what matters; exclude what doesn't (especially sensitive data).
- **Compose.** Select prompts, models, tools, and human checkpoints to fit the intent.
- **Act.** Execute — humans and AI each doing what they do best.
- **Verify.** A human checks outputs against intent, with evidence.
- **Learn.** Capture what worked and what didn't; revise the artifacts.

Every workflow in [workflows/](../workflows/) is an instantiation of this loop.

## A worked example

*Task: publish a market research summary.*

- **People:** an analyst (owner), a reviewer (checkpoint).
- **Context:** three named source reports, a style guide, a deadline.
- **Models:** an LLM for synthesis and first-draft prose.
- **Tools:** a document editor, a citation checker.
- **Evidence:** source list, AI draft, reviewer comments, final diff.
- **Controls:** reviewer sign-off required before publication; retraction procedure defined.
- **Feedback:** a 15-minute retro noting the model conflated two sources — the prompt gets a stronger source-attribution instruction next version.

That's AoT: nothing exotic, everything accounted for.

## Anti-patterns

- **The pipeline with no exits.** AI output flows to action with no human checkpoint. If you can't stop it mid-flight, it isn't orchestration — it's abdication.
- **Context stuffing.** Dumping everything into the prompt, including data nobody consented to share. More context is not better context.
- **Vibes-based verification.** "It reads well" substituting for checking claims against sources.
- **Tool worship.** Designing the workflow around a specific vendor instead of around the job. Tools in AoT workflows are replaceable categories.
- **Provenance amnesia.** Shipping the final artifact and discarding the trail. When someone asks "where did this number come from?" six weeks later, you should have an answer.
- **The confident intern.** Treating fluent output as competent output. Models are eloquent regardless of whether they're right.
- **Learning leakage.** Running the same workflow ten times and never updating it. If nothing feeds back, you have a ritual, not a system.

## Relationship to the rest of this repository

- [Prompts](../prompts/) are the smallest AoT artifacts: one model interaction, fully specified.
- [Workflows](../workflows/) compose prompts, tools, and people into loops with controls.
- The [taxonomy](../taxonomy/) names the parts so artifacts stay machine-readable and comparable.
- The [manifesto](../MANIFESTO.md) states the values the composition must respect.
