# The Prompt Playbook

How prompts move from idea to retirement in this repository. A prompt is a versioned artifact, not a one-off incantation — it gets the same lifecycle discipline as code.

## The lifecycle

```
discover → draft → test → review → version → release → observe → revise → retire
```

### 1. Discover

Notice a task you (or the AI) do repeatedly, badly, or anxiously. Good candidates are tasks with a clear output shape and a real human review point. Check [prompts/](prompts/) first — extend an existing prompt before creating a near-duplicate.

### 2. Draft

Copy the structure from [prompts/README.md](prompts/README.md). Write the front matter and every required section. Design in the safeguards from the start:

- Ask clarifying questions when required information is missing, instead of guessing.
- Distinguish facts from assumptions in output.
- Refuse to fabricate citations, quotes, or data.

Set `status: draft`.

### 3. Test

Run the prompt on the example inputs (fictional, non-sensitive) and at least one real task. Check the output against the prompt's own **Expected output contract** and **Evaluation checks**. Note where it breaks — that goes in **Limitations and failure modes**, honestly.

### 4. Review

A second human reads the prompt against the [quality rubric](docs/QUALITY.md). Reviewers particularly check: are the human review requirements realistic? Are the privacy notes accurate? Would the example mislead anyone?

### 5. Version

Prompts carry a `version` (semver-ish: bump patch for wording, minor for section changes, major for changed output contract). The git history is the changelog.

### 6. Release

Merge to the default branch. Set `status: tested` only once the test step has actually happened with the results recorded in the PR. Run `python tools/yolo.py doctor` before merging.

### 7. Observe

Use it. When output misses the contract, capture the input (sanitized) and the miss. Real usage notes are the most valuable contribution this project can receive.

### 8. Revise

Fold observations back in. Bump the version. If revisions accumulate and the prompt holds, promote to `status: stable`.

### 9. Retire

When a prompt is superseded or no longer advisable, set `status: retired` and add a one-line pointer to its replacement. Don't delete — retired prompts are part of the record.

## Principles that apply to every stage

- **Model-agnostic by default.** Never claim compatibility with a specific model or version unless it was actually tested, and say when.
- **No sensitive data in examples.** Fictional organizations, fictional people, plausible-but-invented numbers.
- **The prompt is not the product; the reviewed output is.** Every prompt states what a human must check before its output is used.
