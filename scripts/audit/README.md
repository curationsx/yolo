# Tier A hygiene audit

Deterministic only: no LLM calls, no API token spend, no repo writes.

## Usage

From the repository root:

```bash
python scripts/audit/hygiene.py .
python scripts/audit/hygiene.py https://github.com/curationsx/yolo.git --out /tmp/run-record.json
python scripts/audit/validate.py /tmp/run-record.json
```

## What it checks

- `.gitignore` exists and covers common junk (`node_modules`, `.env`, `dist`, `build`, `__pycache__`, `.DS_Store`)
- secret-looking committed filenames (`.env`, `*.pem`, `id_rsa`, `credentials.json`)
- committed build artifacts / vendored bulk (`node_modules/`, `dist/`, binaries over 5 MB)
- `README.md` presence + non-trivial content
- `LICENSE` presence
- top-level structure sanity

`hygiene.py` writes a schema-shaped run-record JSON to stdout and optionally `--out`.
Use `validate.py` (requires `jsonschema`) to verify the output against
`schemas/run-record.schema.json`.
