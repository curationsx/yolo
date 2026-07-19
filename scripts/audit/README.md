# Tier A hygiene audit

Deterministic only: no LLM calls, no API token spend, no repo writes.

> **Running the audit as a non-maintainer?** See
> [docs/audits/stranger-guide.md](../../docs/audits/stranger-guide.md) for the
> step-by-step BYOC (bring-your-own-compute) path that runs in your own GitHub
> Actions context without write access to this repository.

## Usage

From the repository root:

```bash
python scripts/audit/hygiene.py .
python scripts/audit/hygiene.py https://github.com/curationsx/yolo.git --out /tmp/run-record.json
python scripts/audit/validate.py /tmp/run-record.json

# Audit a remote repository at an explicit pinned commit SHA (never mutable HEAD):
python scripts/audit/hygiene.py https://github.com/org/repo.git \
    --commit-sha <full-40-char-sha> --out /tmp/run-record.json

# Re-run with lineage (links run-2 back to run-1):
python scripts/audit/hygiene.py . --previous-run <run-1-run-id> --out /tmp/run-2.json
```

## Result format

Each run emits a JSON run-record with a **count-form badge** derived from
`checks_passed`, `checks_total`, and `ruleset_version`:

```
Tier A: 7/7 · hygiene/0.1.0   ← all checks passed
Tier A: 5/7 · hygiene/0.1.0   ← 2 checks failed
```

The badge string is not stored in the record; it is derived from the three
fields above. Gold/silver/bronze labels are not used: they require cohort
calibration that does not yet exist.

## What it checks

Seven deterministic checks are always emitted — one per line in `findings`,
each carrying a `check_id`, `passed` boolean, `severity`, and `detail`:

| check_id | severity on fail | What it tests |
|---|---|---|
| `gitignore_present` | fail | `.gitignore` exists at repository root |
| `gitignore_coverage` | warn | `.gitignore` covers `node_modules`, `.env`, `dist`, `build`, `__pycache__`, `.DS_Store` |
| `sensitive_filenames` | fail | No `.env`, `*.pem`, `id_rsa`, or `credentials.json` in the committed tree |
| `no_vendored_binary_bulk` | warn | No `node_modules/`, `dist/`, or binaries over 5 MB committed |
| `readme_nontrivial` | warn | `README.md` exists and has ≥ 300 characters plus a heading |
| `licence_present` | warn | A `LICENSE` file exists at the repository root |
| `top_level_structure` | info | Top-level names use safe characters; root has < 30 entries |

`checks_total` is always 7 for `hygiene/0.1.0`.

## Measurement fields

Every run-record also carries the required v0.1.0 telemetry fields:

- `wall_clock_seconds` — end-to-end runner latency
- `github_api_requests` — 0 for local paths; 1 for remote-URL clones
- `files_inspected` — count of tracked files
- `bytes_inspected` — total bytes of the tracked tree
- `tokens_spent` — always 0 (no LLM calls)
- `checks_passed` / `checks_total` — raw pass rate
- `ruleset_version` — `"hygiene/0.1.0"` (matches `taxonomy/capabilities.yaml`)
- `commit_sha` — pinned HEAD SHA; null for non-git directories

`hygiene.py` writes a schema-shaped run-record JSON to stdout and optionally `--out`.
Use `validate.py` (requires `jsonschema`) to verify the output against
`schemas/run-record.schema.json`.
