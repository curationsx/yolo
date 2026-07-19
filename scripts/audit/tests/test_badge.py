"""Tests for the count-form badge generator (Lane C).

Falsifying proof: regenerating the badge from the same record must be
byte-identical, and no quality-label wording may ever appear.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
BADGE_PATH = ROOT / "scripts" / "audit" / "badge.py"
RUN_RECORDS = ROOT / "docs" / "audits" / "run-records"

spec = importlib.util.spec_from_file_location("badge", BADGE_PATH)
badge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(badge)

FROZEN_LABELS = ("gold", "silver", "bronze", "grade", "score", "rank")


def _real_record() -> dict:
    """Newest real self-audit record — the canonical badge input."""
    records = [
        json.loads(path.read_text()) for path in sorted(RUN_RECORDS.glob("*.json"))
    ]
    assert records, "real run-records must exist for the canonical badge test"
    return max(records, key=lambda r: r["created_at"])


def test_determinism_byte_identical(tmp_path):
    record = _real_record()
    record_path = tmp_path / "record.json"
    record_path.write_text(json.dumps(record))

    first = tmp_path / "a.svg"
    second = tmp_path / "b.svg"
    badge.main([str(record_path), "--svg-out", str(first)])
    badge.main([str(record_path), "--svg-out", str(second)])
    assert first.read_bytes() == second.read_bytes()


def test_count_form_phrase_exact():
    record = _real_record()
    phrase = badge.count_form(record)
    assert phrase == (
        f"Tier A: {record['checks_passed']}/{record['checks_total']}"
        f" · {record['ruleset_version']}"
    )
    assert badge.render_svg(record).count(phrase) == 2  # <title> + aria-label


def test_no_frozen_quality_labels():
    record = _real_record()
    svg = badge.render_svg(record).lower()
    markdown = badge.render_markdown(record).lower()
    for label in FROZEN_LABELS:
        assert label not in svg, f"frozen label {label!r} leaked into SVG"
        assert label not in markdown, f"frozen label {label!r} leaked into snippet"


def test_markdown_links_back_to_display():
    record = _real_record()
    snippet = badge.render_markdown(record)
    assert snippet.startswith("[![")
    assert f"{record['run_id']}.svg" in snippet
    assert snippet.endswith(f"]({badge.DISPLAY_URL})")


def test_partial_pass_uses_paper_not_lime(tmp_path):
    record = _real_record() | {"checks_passed": 5}
    svg = badge.render_svg(record)
    assert "5/7" in svg
    # Count segment must not celebrate a partial pass with the lime fill.
    assert svg.count(badge.LIME) == 0


def test_fail_closed_on_missing_fields(tmp_path):
    record = _real_record()
    del record["checks_total"]
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(record))
    with pytest.raises(SystemExit):
        badge.load_record(path)


def test_fail_closed_on_impossible_counts(tmp_path):
    record = _real_record() | {"checks_passed": 9}
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(record))
    with pytest.raises(SystemExit):
        badge.load_record(path)
