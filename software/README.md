# Software Directory

A curated, job-to-be-done directory of tools relevant to Human × AI work. This is **not** an affiliate list, a ranking, or an endorsement — it's a map of categories with well-known reference points, maintained under a transparent policy.

The machine-readable entries live in [entries.json](entries.json), validated
against [schemas/software-entry.schema.json](../schemas/software-entry.schema.json).
Browse at [curations.dev](https://curations.dev), or use
`python tools/yolo.py list software`.

## ⚠️ Verify before you rely

Tool facts decay fast. **Always verify directly with the vendor before deciding:** current pricing, terms of service, data retention, whether your data is used for model training, and compliance posture (e.g., regional data residency, industry certifications). Nothing in this directory substitutes for that check, and entries deliberately omit fields that go stale.

## Inclusion criteria

A tool may be listed when it:

- Serves a real job in Human × AI workflows (maps to a directory category).
- Is publicly available and documented (an official site or repository exists).
- Is well-enough established that listing it is descriptive, not promotional.
- Can be described in durable, defensible fields (see entry format).

## Exclusion criteria

We do not list tools:

- In exchange for anything (money, access, promotion) — ever.
- That we can only describe with marketing claims we can't verify.
- Whose primary purpose conflicts with the [manifesto](../MANIFESTO.md) (e.g., covert surveillance of people without consent).

Absence from this list means nothing — probably nobody has proposed it yet. Use
the guided form at [curations.dev/submit](https://curations.dev/submit/) or read
[SUBMIT.md](SUBMIT.md).

## Evaluation rubric (neutral)

When comparing tools *for your own decision*, we suggest these dimensions — the directory itself does not score entries:

| Dimension | Question to ask |
| --- | --- |
| Job fit | Does it do the job you actually have? |
| Data handling | Retention, training use, residency — verified from current terms? |
| Deployment shape | Cloud, self-hosted, local, hybrid — compatible with your constraints? |
| Reversibility | Can you export your data and leave? |
| Interoperability | Standard formats and APIs, or a walled garden? |
| Total cost honesty | Current pricing checked directly, including scale effects? |
| Operational maturity | Documentation, status transparency, support channels? |

## Disclosure and update policy

- No entry is paid for or traded. Contributors must disclose affiliations in submissions ([SUBMIT.md](SUBMIT.md)).
- Entries carry only durable fields; we don't publish pricing or feature inventories that rot.
- Anyone may propose corrections via PR; obviously stale or misleading entries get fixed or removed on evidence.
- Entry changes go through normal PR review like any other artifact.
- Community upvotes show interest, not truth. They do not create paid placement
  or automatically control the editorial `featured` flag.

## Categories and starter collection

The starter collection lists well-known tools per category as *reference points*.
Fields per entry: entity type, primary use, deployment shape, notable strength,
a trade-off or question to verify, and the official reference. Entries may also
carry optional trust metadata: `license` (a coarse bucket — open-source,
source-available, open-weight, proprietary-free-tier, proprietary, or mixed;
these are **not interchangeable terms**), `source_repository`, `platforms`,
`tags`, plus `last_reviewed` and `review_status` so staleness is visible instead
of hidden. `featured` selects a temporary editorial rail and remains separate
from community vote count. See [entries.json](entries.json) for the data.

### Research
- **Zotero** — reference and source management; local-first with sync option; strong open ecosystem; verify sync storage handling for sensitive sources. (zotero.org)

### Model access
- **Ollama** — run open-weight models locally; local deployment; keeps data on your machine; verify hardware requirements against the models you need. (ollama.com)
- **Hugging Face** — model hub and hosted inference; cloud with local download options; breadth of open models; verify license terms of each individual model. (huggingface.co)

### Automation
- **n8n** — workflow automation; self-hosted or cloud; source-available with self-hosting control; verify license fit for your use and connector data flows. (n8n.io)

### Observability / evaluation
- **Langfuse** — LLM application tracing and evaluation; self-hosted or cloud; open-source core; verify what prompt/response data is stored and where. (langfuse.com)

### Knowledge / data
- **Obsidian** — local-first knowledge base in Markdown; local with optional sync; durable plain-text storage; verify plugin trustworthiness — plugins run with local access. (obsidian.md)
- **SQLite** — embedded database for local, auditable data work; local library; zero-dependency durability; verify concurrency fit for multi-writer scenarios. (sqlite.org)
- **Supabase** — Postgres-based backend platform; hosted or self-hosted; portable
  database foundation; verify Row Level Security and current plan limits.
  (supabase.com)

### Development
- **Git** — version control and the provenance backbone of this repository; local with any host; complete history and diff evidence; verify your history-rewriting norms so provenance survives. (git-scm.com)
- **Visual Studio Code** — extensible editor common in AI-assisted development; local app; large extension ecosystem; verify telemetry and extension data-handling settings. (code.visualstudio.com)
- **Cloudflare** — edge development platform; hosted Workers, Pages, storage, and networking; verify runtime limits and data-locality needs. (cloudflare.com)

### Design / content
- **Pandoc** — universal document conversion; local CLI; deterministic, scriptable output; verify fidelity for complex layouts before relying on it. (pandoc.org)

### Community / documentation
- **GitHub** — hosting, review, and community workflows (where this repo lives); cloud; PR review maps directly to human checkpoints; verify data policies for private material. (github.com)
- **Discourse** — community forum platform; self-hosted or hosted; durable, searchable public knowledge; verify moderation workload before committing. (discourse.org)

## Proposing a tool

Start at [curations.dev/submit](https://curations.dev/submit/), or read
[SUBMIT.md](SUBMIT.md). Evidence, not promotion.
