"""Integration tests for the stranger/external path.

These tests make real network calls to a public GitHub repository and are
therefore skipped in the default unit-test run.  Set the environment variable
``RUN_INTEGRATION_TESTS=1`` to include them.

The fixture repository and commit SHA are *public* and *immutable*:
  - Repository: https://github.com/octocat/Hello-World
  - SHA: 7fd1a60b01f91b314f59955a4e4d4e80d8edf11d (HEAD of the repo)

This is an automated external-path contract test, not evidence that a human
stranger has completed the v0.1 release gate.  See docs/audits/stranger-guide.md
for the manual stranger-completion steps.
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
HYGIENE_PATH = ROOT / "scripts" / "audit" / "hygiene.py"
VALIDATE_PATH = ROOT / "scripts" / "audit" / "validate.py"

# Public fixture: small, stable, no secrets.
EXTERNAL_REPO_URL = "https://github.com/octocat/Hello-World.git"
EXTERNAL_COMMIT_SHA = "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d"
WRONG_SHA = "0000000000000000000000000000000000000000"
INVALID_SHA = "not-a-sha"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


hygiene = load_module(HYGIENE_PATH, "hygiene")
validate = load_module(VALIDATE_PATH, "validate_run_record")

needs_network = pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason=(
        "Skipped: requires network access. "
        "Set RUN_INTEGRATION_TESTS=1 to enable the external-path integration tests."
    ),
)


@needs_network
def test_external_repo_audited_at_pinned_sha() -> None:
    """The audit of the external repo must produce a record with the correct commit_sha."""
    root, tempdir = hygiene.resolve_repository(EXTERNAL_REPO_URL, commit_sha=EXTERNAL_COMMIT_SHA)
    try:
        record = hygiene.audit_repository(root, EXTERNAL_REPO_URL)
    finally:
        if tempdir is not None:
            tempdir.cleanup()

    # The run-record must carry the pinned SHA, not a mutable branch HEAD.
    assert record["commit_sha"] == EXTERNAL_COMMIT_SHA, (
        f"Expected commit_sha={EXTERNAL_COMMIT_SHA!r}, got {record['commit_sha']!r}"
    )
    # Schema must be valid.
    errors = validate.validate_record(record)
    assert errors == [], f"Schema validation errors: {errors}"
    # No token spend for Tier A.
    assert record["tokens_spent"] == 0
    # Serialisable.
    json.dumps(record)


@needs_network
def test_external_repo_wrong_sha_fails_closed() -> None:
    """A mismatched SHA must raise SystemExit and not audit a fallback revision."""
    with pytest.raises(SystemExit):
        hygiene.resolve_repository(EXTERNAL_REPO_URL, commit_sha=WRONG_SHA)


def test_invalid_sha_rejected_before_network() -> None:
    """An invalid SHA format must be rejected immediately, before any git I/O."""
    with pytest.raises(SystemExit, match="Invalid commit SHA"):
        hygiene.resolve_repository(EXTERNAL_REPO_URL, commit_sha=INVALID_SHA)


@needs_network
def test_count_form_summary_values_from_record() -> None:
    """The count-form summary fields must be derivable from the run-record."""
    root, tempdir = hygiene.resolve_repository(EXTERNAL_REPO_URL, commit_sha=EXTERNAL_COMMIT_SHA)
    try:
        record = hygiene.audit_repository(root, EXTERNAL_REPO_URL)
    finally:
        if tempdir is not None:
            tempdir.cleanup()

    passed = record["checks_passed"]
    total = record["checks_total"]
    version = record["ruleset_version"]
    sha = record["commit_sha"]

    # Build the count-form summary string and verify its components.
    summary = f"Tier A: {passed}/{total} · {version}"
    assert "Tier A:" in summary
    assert f"{passed}/{total}" in summary
    assert version == "hygiene/0.1.0"
    assert sha == EXTERNAL_COMMIT_SHA
