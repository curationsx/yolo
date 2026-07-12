# Glossary

Terms used consistently across CurationsX YOLO. If a document uses one of these words, it means this.

**AoT (Artificial of Things)** — The connective practice of composing people, context, models, tools, evidence, controls, and feedback into useful systems. See [AOT.md](AOT.md).

**Artifact** — Any versioned, reusable unit in this repository: a prompt, a workflow, a software entry, a schema, a document.

**Actor** — A participant in a workflow: a human role (e.g., *analyst*, *reviewer*) or an AI/tool capability (e.g., *synthesis model*). Always a role or category, never a named vendor.

**Catalog** — The machine-readable index of repository artifacts, generated and checked deterministically by the CLI (`python tools/yolo.py catalog`).

**Checkpoint (human checkpoint)** — A defined point in a workflow where a human must review, approve, or stop the work before it proceeds. Every workflow has at least one.

**Context** — The facts, constraints, history, and sources deliberately provided to a model or workflow. Deliberate is the operative word.

**Controls** — Mechanisms that bound a workflow: checkpoints, approval requirements, limits, and rollback paths.

**Doctor** — The CLI health check (`python tools/yolo.py doctor`) that validates artifacts against repository conventions.

**Evidence** — Artifacts captured during a workflow that let someone audit it later: sources, drafts, diffs, review notes, logs.

**Front matter** — The YAML metadata block at the top of a prompt or workflow file, matching the corresponding schema in [schemas/](../schemas/).

**Human primacy** — The principle that humans set intent, review outputs, and own consequential decisions. See [MANIFESTO.md](../MANIFESTO.md).

**Lifecycle** — The stages a prompt moves through: discover, draft, test, review, version, release, observe, revise, retire. See [PLAYBOOK.md](../PLAYBOOK.md).

**Output contract** — A prompt's explicit statement of the structure and properties its output must have, so results are checkable.

**Pre-mortem** — A safety exercise imagining a plan has already failed and working backward to causes. See the [pre-mortem prompt](../prompts/safety-pre-mortem.md).

**Provenance** — The traceable record of how an artifact came to be: which humans, which models, which sources, which versions.

**Rollback** — The documented way to undo or recover from a workflow step. Specified before speed.

**Rubber duck** 🦆 — The practice (and mascot) of explaining work out loud to expose gaps in reasoning. See the [rubber-duck debugging prompt](../prompts/engineering-rubber-duck-debugging.md).

**Status** — An artifact's honesty label: `draft`, `tested`, `stable`, or `retired`. See [QUALITY.md](QUALITY.md).

**Steward** — A maintainer responsible for upholding the manifesto and quality model in reviews. See the [Digital Stewardship PRD](PRD-digital-stewardship.md).

**Taxonomy** — The versioned, machine-readable vocabulary of AoT concepts in [taxonomy/](../taxonomy/).

**Workflow** — A composed, repeatable Human × AI process with actors, steps, checkpoints, evidence, and rollback. See [workflows/README.md](../workflows/README.md).

**YOLO** — Your Operations, Leverage, and Orchestration. Ambitious experimentation with explicit review, recovery, and accountability.
