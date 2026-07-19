"""Tests for the truthful delta tool (Lane E).

Falsifying proof: a re-run with zero changes must say "no change" rather
than manufacturing improvement.
"""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
DELTA_PATH = ROOT / "scripts" / "audit" / "delta.py"
RUN_RECORDS = ROOT / "docs" / "audits" / "run-records"

spec = importlib.util.spec_from_file_location("delta", DELTA_PATH)
delta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delta)


def _records_by_id() -> dict:
    records = {}
    for path in RUN_RECORDS.glob("*.json"):
        record = json.loads(path.read_text())
        records[record["run_id"]] = record
    return records


def _canonical_pair():
    """run-3 (7/7) and its true predecessor run-2 (5/7)."""
    records = _records_by_id()
    current = max(records.values(), key=lambda r: r["created_at"])
    assert current["previous_run"], "newest record must have lineage"
    return current, records[current["previous_run"]]


def test_falsifying_proof_no_change_says_no_change():
    current, _previous = _canonical_pair()
    rerun = copy.deepcopy(current)
    rerun["run_id"] = "99999999-9999-4999-8999-999999999999"
    rerun["previous_run"] = current["run_id"]
    result = delta.compute_delta(rerun, current)
    assert result["no_change"] is True
    assert result["fixed"] == []
    assert result["regressed"] == []
    assert delta.format_delta(result).startswith("no change vs run ")


def test_canonical_run2_to_run3_delta_is_exact():
    current, previous = _canonical_pair()
    result = delta.compute_delta(current, previous)
    assert result["no_change"] is False
    assert result["fixed"] == ["licence_present", "sensitive_filenames"]
    assert result["regressed"] == []
    assert result["added"] == []
    assert result["removed"] == []
    line = delta.format_delta(result)
    assert "+licence_present" in line
    assert "+sensitive_filenames" in line
    assert previous["run_id"][:8] in line


def test_regressions_are_reported_not_smoothed():
    current, previous = _canonical_pair()
    worse = copy.deepcopy(current)
    for finding in worse["findings"]:
        if finding["check_id"] == "readme_nontrivial":
            finding["passed"] = False
    result = delta.compute_delta(worse, previous)
    assert "readme_nontrivial" in result["regressed"]


def test_ruleset_mismatch_is_refused():
    current, previous = _canonical_pair()
    other = copy.deepcopy(previous)
    other["ruleset_version"] = "hygiene/0.2.0"
    with pytest.raises(SystemExit, match="ruleset mismatch"):
        delta.compute_delta(current, other)


def test_unrelated_records_are_refused():
    current, previous = _canonical_pair()
    stranger = copy.deepcopy(previous)
    stranger["run_id"] = "00000000-0000-4000-8000-000000000000"
    with pytest.raises(SystemExit, match="lineage mismatch"):
        delta.compute_delta(current, stranger)


def test_added_and_removed_checks_are_named():
    current, previous = _canonical_pair()
    grown = copy.deepcopy(current)
    grown["findings"].append(
        {
            "check_id": "brand_new_check",
            "artifact": "x",
            "confidence": 1,
            "passed": True,
            "severity": "info",
            "detail": "new",
        }
    )
    result = delta.compute_delta(grown, previous)
    assert result["added"] == ["brand_new_check"]
    assert result["no_change"] is False
