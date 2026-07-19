# External BYOC product-promise runbook (`curationsdev/community`)

Use this runbook for the stacked follow-up targeting PR #48's branch. It
validates that a caller repository can run the reusable hygiene workflow with
immutable pins and produce reproducible evidence.

## Scope and pins

- **Caller repository:** `curationsdev/community`
- **Target repository to audit:** `https://github.com/curationsdev/community.git`
- **Target commit:** obtain a fresh immutable 40-character SHA at execution time
  (never rely on a stale documented HEAD).

Pinning policy:

1. **Pre-merge warm-up:** pin both:
   - reusable workflow `uses:` reference; and
   - `audit_ref`
   to the exact `curationsx/yolo` commit SHA containing this stacked change.
2. **After merge/release:** pin both values to an immutable release commit SHA
   or release tag per policy. A full commit SHA is the strongest pin.

## Caller workflow (ready to copy)

Create this file in `curationsdev/community` at
`.github/workflows/run-yolo-hygiene-audit.yml` and commit to the default branch:

```yaml
name: Run YOLO Hygiene Audit

on:
  workflow_dispatch:
    inputs:
      repo_url:
        description: "Public repository URL to audit"
        required: true
        type: string
      commit_sha:
        description: "Full 40-character immutable commit SHA to audit"
        required: true
        type: string
      audit_ref:
        description: "curationsx/yolo audit implementation ref (full SHA recommended)"
        required: true
        type: string

permissions:
  contents: read

jobs:
  audit:
    uses: curationsx/yolo/.github/workflows/hygiene-audit-reusable.yml@<YOLO_REF>
    with:
      repo_url: ${{ inputs.repo_url }}
      commit_sha: ${{ inputs.commit_sha }}
      audit_ref: ${{ inputs.audit_ref }}
```

Replace `<YOLO_REF>` with the same immutable commit SHA passed as `audit_ref`.

## CLI execution handoff

```bash
# 0) Set values
export CALLER_REPO="curationsdev/community"
export TARGET_REPO_URL="https://github.com/curationsdev/community.git"
export YOLO_REF="<40-char yolo commit sha containing this follow-up>"

# 1) Obtain fresh target SHA at execution time
export TARGET_SHA="$(git ls-remote "$TARGET_REPO_URL" HEAD | awk '{print $1}')"
echo "$TARGET_SHA"

# 2) Dispatch caller workflow (from curationsdev/community default branch)
gh workflow run run-yolo-hygiene-audit.yml \
  --repo "$CALLER_REPO" \
  -f repo_url="$TARGET_REPO_URL" \
  -f commit_sha="$TARGET_SHA" \
  -f audit_ref="$YOLO_REF"

# 3) Watch the run
gh run watch --repo "$CALLER_REPO" --exit-status

# 4) Inspect summary and logs
RUN_ID="$(gh run list --repo "$CALLER_REPO" --workflow run-yolo-hygiene-audit.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run view "$RUN_ID" --repo "$CALLER_REPO"
gh run view "$RUN_ID" --repo "$CALLER_REPO" --log

# 5) Download artifact and validate
mkdir -p /tmp/hygiene-artifact
gh run download "$RUN_ID" --repo "$CALLER_REPO" --name hygiene-run-record --dir /tmp/hygiene-artifact
git clone https://github.com/curationsx/yolo.git /tmp/yolo-audit
python /tmp/yolo-audit/scripts/audit/validate.py /tmp/hygiene-artifact/run-record.json

# 6) Verify key fields
python - <<'PY'
import json
from pathlib import Path
record = json.loads(Path("/tmp/hygiene-artifact/run-record.json").read_text())
print("commit_sha=", record["commit_sha"])
print("checks_passed=", record["checks_passed"])
print("checks_total=", record["checks_total"])
print("tokens_spent=", record["tokens_spent"])
PY
```

## Acceptance criteria

- Run executes in the caller account/repository (`curationsdev/community`).
- `run-record.json` contains the exact `commit_sha` that was dispatched.
- Job summary displays the audit implementation ref (`audit_ref`).
- Record validates successfully against schema.
- `hygiene-run-record` artifact downloads successfully.
- Reusable workflow outputs `checks_passed` and `checks_total` are populated.
- No repository writes occur.
- `tokens_spent` is `0`.

## Temporary workflow rollback

If the caller workflow was only for warm-up, remove it after evidence capture:

```bash
git rm .github/workflows/run-yolo-hygiene-audit.yml
git commit -m "chore: remove temporary yolo hygiene audit warm-up workflow"
git push
```
