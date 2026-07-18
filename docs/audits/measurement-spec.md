---
status: silver
category: measurement
title: "Measurement hooks specification — telemetry every run must capture"
created: 2026-07-18
relates_to:
  - docs/audits/2026-07-18-silver-audit-synthesis.md
  - schemas/run-record.schema.json
  - taxonomy/capabilities.yaml
owner: CurationsLA
---

# Measurement Hooks Specification

> Telemetry that every audit run must capture from day one so that operational
> quotas, cost models, and quality metrics can be derived from evidence rather
> than guessed.
>
> **Do not modify `schemas/run-record.schema.json` in this task** — that file is
> owned by PR #43 (`copilot/build-hygiene-audit-script`). The fields marked
> **required in v0.1.0** must be present in PR #43's schema. Fields marked
> **future minor version** are tracked here for the next schema iteration.

---

## Rationale

Without instrumentation from the first run, the platform cannot answer:

- "How long does a hygiene audit take? Does it vary by repo size?"
- "How many GitHub API requests does a run consume? Are we near rate limits?"
- "Which check fails most often? Is it a quality signal or a noisy check?"
- "What is the abandonment rate between submission and completed run?"
- "Does caching reduce re-run cost meaningfully?"

These are not nice-to-have analytics — they are required inputs for quota setting,
BYOC cost modelling, and deciding when a check is calibrated enough to trust. Collecting
them from day one costs nothing; retrofitting them after a corpus of run-records exists
is expensive and produces an unrepresentative baseline.

---

## Required fields — must be in every run-record from v0.1.0

These fields must be present in `schemas/run-record.schema.json` (PR #43) and
populated by every capability runner.

| Field | Type | Unit | Notes |
|---|---|---|---|
| `wall_clock_seconds` | number | seconds | Total elapsed time from script entry to run-record write. Measures end-to-end runner latency. |
| `github_api_requests` | integer | count | Number of GitHub API calls made during the run (clone, file fetch, SHA resolution, etc.). Required for rate-limit planning. |
| `files_inspected` | integer | count | Number of files the runner examined (walked, read, or pattern-matched). Measures scope of the pass. |
| `bytes_inspected` | integer | bytes | Total bytes read from the repository tree. Measures data volume processed. |
| `tokens_spent` | integer | tokens | LLM tokens consumed. Always 0 for Tier A (no LLM calls); must be present so Tier B records are comparable. |
| `checks_passed` | integer | count | Number of individual checks that returned a passing result. |
| `checks_total` | integer | count | Total number of checks attempted. `checks_passed / checks_total` is the per-run pass rate. |
| `ruleset_version` | string | semver | Capability version that produced this record, e.g. `"hygiene/0.1.0"`. Required for badge reproducibility and cohort comparison. |
| `commit_sha` | string | SHA-1/SHA-256 | Immutable commit the runner observed. Required for evidence provenance. |

---

## Per-cell failure rate — required in findings array

Each entry in the `findings` array must carry enough data to compute per-check
failure rates across the run-record corpus. Minimum fields per finding:

| Field | Type | Notes |
|---|---|---|
| `check_id` | string | Matches `id` in `taxonomy/capabilities.yaml` |
| `passed` | boolean | True if this specific check passed |
| `severity` | string | `fail`, `warn`, `info` — from the capability manifest |
| `detail` | string | Human-readable explanation of the finding |

This allows answering: "What fraction of all runs failed `sensitive_filenames`?
Is it high because repos genuinely have issues, or because the pattern is too
broad?"

---

## Future schema minor version — fields to add next

These fields are tracked here and must not be added to PR #43's schema file
(different branch). They are candidates for the next minor version bump of
`schemas/run-record.schema.json`.

| Field | Type | Unit | Rationale |
|---|---|---|---|
| `retry_count` | integer | count | How many times the runner retried a failed operation (clone, API call). High retry rates indicate infrastructure instability. |
| `cache_hit` | boolean | — | Whether the run used a cached repository clone. Measures cache effectiveness and whether re-run cost is actually reduced. |
| `actions_minutes_billed` | number | minutes | Elapsed Actions minutes billed to the submitter's account (BYOC). Required for accurate cost communication to users. |
| `abandonment_point` | string\|null | step name | If the run did not complete, which step was the last successfully completed step. Required for funnel analysis (submission → run → record → badge → fix → rerun). |
| `user_completion_step` | string\|null | step name | The last step the user reached in the UI before leaving. Paired with `abandonment_point` to separate runner failures from user drop-off. |

---

## Measurement-driven decisions this data enables

Once a corpus of run-records exists (target: 10 self-audit runs of `curationsx/yolo`
before any external submission), the following operational decisions can be made with
evidence:

| Decision | Required fields |
|---|---|
| Set per-owner monthly run quota | `wall_clock_seconds`, `actions_minutes_billed` |
| Calibrate badge score bands (when cohort exists) | `checks_passed`, `checks_total`, per-check `passed` rates across corpus |
| Detect noisy / low-signal checks | per-check `passed` rates; high failure rate on `info`-severity checks |
| Determine cache effectiveness | `cache_hit`, `wall_clock_seconds` (cached vs uncached) |
| Identify the BYOC funnel drop-off point | `abandonment_point`, `user_completion_step` |
| Estimate GitHub API rate-limit headroom | `github_api_requests` per run × projected daily run volume |
| Validate that Tier A is truly token-free | `tokens_spent` — any non-zero value in Tier A is a budget leak |

---

## Instrumentation contract

Every capability registered in `taxonomy/capabilities.yaml` is responsible for
populating the fields listed in its `output_contract.fields` block. A run-record
that is missing any required field must fail schema validation and must not be
persisted or used to issue a badge.

The schema validator (`scripts/audit/validate.py`, PR #43) enforces this. A future
CI step should run validation on every run-record artifact produced by the
self-audit Action, so instrumentation regressions are caught immediately.
