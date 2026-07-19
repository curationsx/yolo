"""Contract tests for the Phase B public schemas (suggestion plan +
grounding snapshot).

These schemas are open-core contracts: the intelligence that fills them is
private, but the shapes — and therefore the verifiability of citations and
lineage — are public. A sample of each is validated here so the contracts
can never drift silently.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
PLAN_SCHEMA = json.loads((ROOT / "schemas" / "suggestion-plan.schema.json").read_text())
SNAPSHOT_SCHEMA = json.loads(
    (ROOT / "schemas" / "grounding-snapshot.schema.json").read_text()
)


def sample_plan() -> dict:
    return {
        "plan_id": "plan-0001",
        "responds_to_run": "1cfefdca-0109-4dad-ae79-a8665f60a12c",
        "created_at": "2026-07-19T12:00:00Z",
        "generator": {
            "name": "curator-generator",
            "version": "0.1.0",
            "prompt_components": ["capability-manifest@hygiene/0.1.0"],
        },
        "grounding": None,
        "citations": [
            {"kind": "run-record", "ref": "1cfefdca-0109-4dad-ae79-a8665f60a12c"},
            {"kind": "capability-manifest", "ref": "taxonomy/capabilities.yaml@hygiene/0.1.0"},
        ],
        "steps": [
            {
                "step_id": "s1",
                "kind": "manual",
                "title": "Cover build artifacts in .gitignore",
                "body": "Add 'build/' and '__pycache__/' lines to .gitignore.",
                "addresses_check": "gitignore_coverage",
            }
        ],
        "consent_note": "Nothing is shared back automatically.",
    }


def sample_snapshot() -> dict:
    return {
        "snapshot_ref": "bing/2026-W30/devtools",
        "captured_at": "2026-07-20T05:41:00Z",
        "provider": "azure-foundry-bing-grounding",
        "categories": ["devtools"],
        "queries": ["state of the art repository hygiene tooling 2026"],
        "content_digest": "sha256:" + "a" * 64,
        "item_count": 12,
        "spend": {"cap_usd": 1.0, "spent_usd": 0.13, "within_cap": True},
        "previous_snapshot": None,
    }


def test_schemas_are_valid_json_schema():
    Draft202012Validator.check_schema(PLAN_SCHEMA)
    Draft202012Validator.check_schema(SNAPSHOT_SCHEMA)


def test_sample_plan_validates():
    Draft202012Validator(PLAN_SCHEMA, format_checker=FormatChecker()).validate(
        sample_plan()
    )


def test_sample_snapshot_validates():
    Draft202012Validator(SNAPSHOT_SCHEMA, format_checker=FormatChecker()).validate(
        sample_snapshot()
    )


def test_plan_rejects_unknown_citation_kind_and_platform_write_lane():
    validator = Draft202012Validator(PLAN_SCHEMA)
    bad_citation = sample_plan()
    bad_citation["citations"][0]["kind"] = "vibes"
    assert list(validator.iter_errors(bad_citation))

    bad_lane = sample_plan()
    bad_lane["steps"][0]["kind"] = "platform-writes-to-your-repo"
    assert list(validator.iter_errors(bad_lane))


def test_snapshot_rejects_unverifiable_digest_and_negative_spend():
    validator = Draft202012Validator(SNAPSHOT_SCHEMA)
    bad_digest = sample_snapshot()
    bad_digest["content_digest"] = "trust-me"
    assert list(validator.iter_errors(bad_digest))

    bad_spend = sample_snapshot()
    bad_spend["spend"]["spent_usd"] = -1
    assert list(validator.iter_errors(bad_spend))


def test_run_record_links_plan_ref_field():
    run_schema = json.loads(
        (ROOT / "schemas" / "run-record.schema.json").read_text()
    )
    assert "suggestion_plan_ref" in run_schema["properties"], (
        "run-record schema must carry the field that links deltas to plans"
    )
