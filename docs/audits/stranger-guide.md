# Stranger guide — running the Tier A hygiene audit in your own GitHub Actions

This guide explains how a person unfamiliar with `curationsx/yolo` can run the
deterministic Tier A hygiene audit against any public GitHub repository using
their **own** GitHub Actions entitlement.  No write access to `curationsx/yolo`
is required, and the audit does not write to your repository.

---

## Prerequisites

- A GitHub account with Actions enabled.
- A **public** GitHub repository that you want to audit.

> **v0.1 limitation:** only public repositories are supported.  The audit
> clones the target repository with no credentials.

---

## Step 1 — Add the caller workflow to your repository

Create the file `.github/workflows/run-hygiene-audit.yml` in your repository
with the following contents:

```yaml
name: Run Tier A Hygiene Audit

on:
  workflow_dispatch:
    inputs:
      repo_url:
        description: "Public GitHub repository URL to audit"
        required: true
        type: string
      commit_sha:
        description: "Full 40-character immutable commit SHA"
        required: true
        type: string

jobs:
  audit:
    uses: curationsx/yolo/.github/workflows/hygiene-audit-reusable.yml@main
    with:
      repo_url: ${{ inputs.repo_url }}
      commit_sha: ${{ inputs.commit_sha }}
```

Commit and push this file to your repository's default branch.  No secrets or
additional configuration are needed.

---

## Step 2 — Obtain an immutable commit SHA

You need a **full 40-character** commit SHA.  Do not use a branch name or tag:
those are mutable and the audit will reject them if they do not match a SHA.

**Option A — from the GitHub web UI:**

1. Navigate to the target repository on GitHub.
2. Click **Commits** (or open any commit).
3. Click the copy icon next to the full SHA, or copy it from the URL
   (e.g. `github.com/org/repo/commit/<sha>`).

**Option B — from the command line:**

```bash
git ls-remote https://github.com/org/repo.git HEAD
# Outputs: <40-char SHA>  HEAD
```

Or for a specific branch:

```bash
git ls-remote https://github.com/org/repo.git refs/heads/main
```

---

## Step 3 — Dispatch the run

1. Go to your repository on GitHub.
2. Click **Actions** → **Run Tier A Hygiene Audit** → **Run workflow**.
3. Fill in the two required inputs:
   - **repo_url**: the HTTPS URL of the public repository to audit
     (e.g. `https://github.com/org/repo.git`)
   - **commit_sha**: the full 40-character SHA obtained in Step 2
4. Click **Run workflow**.

---

## Step 4 — Download the run-record and read the summary

Once the workflow completes:

- **Job summary:** click the workflow run → click the `audit` job →
  scroll to the bottom.  You will see a summary such as:

  ```
  Tier A: 7/7 · hygiene/0.1.0

  Audited commit: `<sha>`

  The downloadable run-record.json artifact is commit-bound and schema-valid.
  ```

- **Artifact:** click **Summary** (top of the run page) → scroll to
  **Artifacts** → download `hygiene-run-record`.  The zip contains
  `run-record.json`, the schema-valid audit record.

---

## Permissions and billing

| Aspect | Detail |
|---|---|
| **Billing** | Runner minutes are charged to your GitHub account (the caller). `curationsx/yolo` is not billed. |
| **Write access** | You need no write access to `curationsx/yolo`. |
| **Secrets** | No secrets are required or used. |
| **Your repository** | The workflow does not write to your repository or any other repository. |
| **Target repository** | Must be public; no credentials are used during the clone. |

---

## What the audit does and does not do

- **Does:** clone the repository at exactly the pinned commit SHA, run seven
  deterministic checks, emit a schema-valid `run-record.json`, and upload it
  as a GitHub Actions artifact.
- **Does not:** make any LLM/model calls (`tokens_spent` is always 0), write
  to any repository, publish findings anywhere, or perform any network call
  beyond the git clone.

---

## Common failure cases

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid commit SHA` | The SHA is not a full 40-character hex string. | Use `git ls-remote` or copy the SHA from GitHub's commit page. |
| `Failed to fetch commit` | The SHA is unreachable (not present in the remote repository). | Verify the SHA belongs to the target repository. |
| `SHA mismatch` | The fetched HEAD does not match the requested SHA (should not normally occur for public GitHub repos). | Check the SHA is correct and retry. |
| `Repository does not exist or is private` | The target repository is private or the URL is wrong. | Only public repositories are supported in v0.1. |
| Workflow not found | The caller workflow file is not on the default branch, or was not pushed before dispatching. | Commit and push the file, then retry. |

---

## Validating the run-record locally

If you want to validate the downloaded artifact on your own machine:

```bash
pip install jsonschema
git clone https://github.com/curationsx/yolo.git
python curationsx/yolo/scripts/audit/validate.py /path/to/run-record.json
# Prints: run-record is valid
```

---

## Remaining manual step (v0.1)

The automated path verifies that the audit runs and the run-record is
schema-valid.  The human stranger-completion gate (publishing a finding as a
verified non-maintainer) is a future v0.1 milestone that requires an
authenticated GitHub identity and is not yet implemented.
