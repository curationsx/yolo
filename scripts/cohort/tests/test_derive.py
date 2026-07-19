"""Tests for the cohort ledger derivation (Phase A).

Falsifying proofs:
1. Byte-identical re-derivation — same corpus, same bytes.
2. An out-of-window record can never appear inside a cohort.
3. Closed-cohort immutability — appending later records never changes an
   earlier cohort's block.
"""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
DERIVE_PATH = ROOT / "scripts" / "cohort" / "derive.py"
SELF_AUDIT = ROOT / "docs" / "audits" / "run-records"
EXTERNAL = ROOT / "docs" / "audits" / "external" / "curationsdev-community"
CONFIG = ROOT / "taxonomy" / "cohorts.yaml"

spec = importlib.util.spec_from_file_location("derive", DERIVE_PATH)
derive_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(derive_mod)


def real_ledger() -> dict:
    config = derive_mod.load_config(CONFIG)
    records = derive_mod.load_records([SELF_AUDIT, EXTERNAL])
    return derive_mod.derive(records, config)


def test_falsifying_proof_byte_identical_rederivation(tmp_path):
    first = tmp_path / "a.json"
    second = tmp_path / "b.json"
    argv = [
        "--records", str(SELF_AUDIT),
        "--records", str(EXTERNAL),
        "--config", str(CONFIG),
    ]
    derive_mod.main([*argv, "--out", str(first)])
    derive_mod.main([*argv, "--out", str(second)])
    assert first.read_bytes() == second.read_bytes()


def test_real_corpus_seeds_2026_q3():
    ledger = real_ledger()
    q3 = next(c for c in ledger["cohorts"] if c["cohort_id"] == "2026-Q3")
    assert q3["total_runs"] == 5          # 3 self-audit + 2 external
    assert q3["unique_journeys"] == 2     # yolo chain + community chain
    assert q3["first_run_journeys"] == 2
    assert q3["improved_journeys"] == 2   # both journeys completed a fix loop
    assert q3["first_fix_rate"] == 1.0    # the G6 metric, from real evidence
    assert q3["linked_reruns"] == 3
    assert q3["improved_runs"] == 3       # 4->5, 5->7, 6->7
    assert q3["sub_cohorts"] == {"2026-Q3.r2": 2, "2026-Q3.r3": 1}
    assert ledger["unassigned_run_ids"] == []


def _synthetic(run_id: str, created_at: str, previous=None, passed=5, fingerprint="sha256:zz"):
    return {
        "run_id": run_id,
        "repo_fingerprint": fingerprint,
        "previous_run": previous,
        "created_at": created_at,
        "checks_passed": passed,
        "checks_total": 7,
        "ruleset_version": "hygiene/0.1.0",
    }


def test_falsifying_proof_out_of_window_record_never_appears():
    config = derive_mod.load_config(CONFIG)
    records = derive_mod.load_records([SELF_AUDIT, EXTERNAL])
    stray = _synthetic("00000000-0000-4000-8000-00000000dead", "2025-01-01T00:00:00Z")
    ledger = derive_mod.derive([*records, stray], config)
    assert stray["run_id"] in ledger["unassigned_run_ids"]
    for cohort in ledger["cohorts"]:
        assert stray["run_id"] not in cohort["run_ids"]


def test_falsifying_proof_closed_cohort_immutable_under_append():
    config = derive_mod.load_config(CONFIG)
    records = derive_mod.load_records([SELF_AUDIT, EXTERNAL])
    before = derive_mod.derive(records, config)
    q4_record = _synthetic("00000000-0000-4000-8000-0000000000q4".replace("q", "a"), "2026-10-05T00:00:00Z")
    after = derive_mod.derive([*records, q4_record], config)
    q3_before = next(c for c in before["cohorts"] if c["cohort_id"] == "2026-Q3")
    q3_after = next(c for c in after["cohorts"] if c["cohort_id"] == "2026-Q3")
    assert q3_before == q3_after


def test_categories_feed_inquiry_buckets():
    config = derive_mod.load_config(CONFIG)
    tagged = _synthetic("00000000-0000-4000-8000-0000000000aa", "2026-07-20T00:00:00Z")
    tagged["categories"] = {
        "vocabulary_version": "categories/0.1.0",
        "observed": ["astro", "azure"],
        "declared": ["community"],
    }
    ledger = derive_mod.derive([tagged], config)
    q3 = next(c for c in ledger["cohorts"] if c["cohort_id"] == "2026-Q3")
    assert q3["inquiry_buckets"]["observed"] == {"astro": 1, "azure": 1}
    assert q3["inquiry_buckets"]["declared"] == {"community": 1}


def test_fail_closed_on_malformed_and_duplicate_records(tmp_path):
    bad_dir = tmp_path / "bad"
    bad_dir.mkdir()
    (bad_dir / "x.json").write_text(json.dumps({"run_id": "only-an-id"}))
    with pytest.raises(SystemExit, match="missing fields"):
        derive_mod.load_records([bad_dir])

    dup_dir = tmp_path / "dup"
    dup_dir.mkdir()
    record = _synthetic("00000000-0000-4000-8000-0000000000bb", "2026-07-20T00:00:00Z")
    (dup_dir / "a.json").write_text(json.dumps(record))
    (dup_dir / "b.json").write_text(json.dumps(record))
    with pytest.raises(SystemExit, match="duplicate run_id"):
        derive_mod.load_records([dup_dir])


def test_overlapping_windows_are_refused(tmp_path):
    bad_config = tmp_path / "cohorts.yaml"
    bad_config.write_text(
        "config_version: test\n"
        "cohorts:\n"
        "  - cohort_id: A\n    opened_at: '2026-01-01'\n    closes_at: '2026-06-30'\n    trigger: calendar\n"
        "  - cohort_id: B\n    opened_at: '2026-06-01'\n    closes_at: '2026-12-31'\n    trigger: calendar\n"
    )
    with pytest.raises(SystemExit, match="overlap"):
        derive_mod.load_config(bad_config)
