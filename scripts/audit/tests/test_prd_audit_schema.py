"""Contract tests for schemas/prd-audit.schema.json.

The PRD audit report is the public face of the Golden Standard defined in
docs/audits/2026-07-20-prd-golden-standard-discovery.md. Two of its properties
are load-bearing and are therefore tested as behaviour rather than trusted as
documentation:

1. Conditional applicability. A pillar that does not apply must be EXCLUDED,
   never scored zero. An internal admin CLI has no market; a forensic tool has
   no community. Scoring them zero would be a factual claim we cannot support.

2. Disengagement. When an agent meets restricted content, apparent personal
   data, or apparent credentials, the report may record a reason code and
   nothing else. The tests below assert that the schema structurally REJECTS
   any attempt to describe, excerpt, or locate what was seen, so the protocol
   cannot be weakened by a future well-meaning patch.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
AUDIT_SCHEMA = json.loads((ROOT / "schemas" / "prd-audit.schema.json").read_text())

PILLARS = ("viability", "blueprint", "resilience", "safety", "delegation", "legibility")


def validator() -> Draft202012Validator:
    return Draft202012Validator(AUDIT_SCHEMA, format_checker=FormatChecker())


def errors_for(document: dict) -> list[str]:
    return [error.message for error in validator().iter_errors(document)]


def finding(check_id: str = "blueprint.data-shapes-declared") -> dict:
    return {
        "check_id": check_id,
        "passed": False,
        "artifact": "docs/PRD.md#data-model",
        "confidence": 0.9,
        "detail": "The PRD names a Venues and an Events entity but never states the relationship between them.",
        "severity": "warn",
    }


def scored_pillar(score: int = 72, band: str = "great") -> dict:
    return {
        "applicability": "applies",
        "score": score,
        "band": band,
        "findings": [finding()],
    }


def skipped_pillar(rationale: str = "This repository is an internal administrative CLI with no external users, so market moat is not a meaningful measure.") -> dict:
    return {"applicability": "not_applicable", "rationale": rationale}


def sample_report(**overrides) -> dict:
    report = {
        "report_id": "1cfefdca-0109-4dad-ae79-a8665f60a12c",
        "schema_version": "0.1.0",
        "subject": {
            "repository": "curationsdev/community",
            "commit_sha": "a" * 40,
            "prd_paths": ["docs/PRD.md"],
            "repo_fingerprint": "sha256:" + "b" * 64,
        },
        "tier": "A",
        "ruleset_version": "0.1.0",
        "created_at": "2026-08-01T12:00:00Z",
        "pillars": {name: scored_pillar() for name in PILLARS},
        "composite": {
            "score": 72,
            "band": "great",
            "pillars_scored": list(PILLARS),
            "pillars_excluded": [],
        },
        "comparison": None,
        "disengagement": None,
    }
    report.update(overrides)
    return report


# --------------------------------------------------------------- baseline

def test_schema_itself_is_valid():
    Draft202012Validator.check_schema(AUDIT_SCHEMA)


def test_fully_scored_report_is_valid():
    assert errors_for(sample_report()) == []


def test_all_six_pillars_are_required():
    report = sample_report()
    del report["pillars"]["legibility"]
    assert errors_for(report), "a report may not silently omit a pillar"


def test_community_is_not_a_pillar():
    """The 2026-07-20 session retired Community as a scored pillar. It lives in
    'comparison' as non-scoring context. Reintroducing it as a pillar must fail."""
    report = sample_report()
    report["pillars"]["community"] = scored_pillar()
    assert errors_for(report)


# ------------------------------------------------ conditional applicability

def test_not_applicable_pillar_needs_a_rationale():
    report = sample_report()
    report["pillars"]["viability"] = {"applicability": "not_applicable"}
    assert errors_for(report), "skipping a pillar without explaining why is not allowed"


def test_not_applicable_pillar_may_not_carry_a_score():
    """This is the heart of it. A pillar that does not apply is excluded, not
    zeroed. A score here would assert something we did not measure."""
    report = sample_report()
    report["pillars"]["viability"] = {
        "applicability": "not_applicable",
        "rationale": "Internal administrative CLI with no external users.",
        "score": 0,
        "band": "meh",
        "findings": [finding()],
    }
    assert errors_for(report)


def test_applicable_pillar_must_carry_score_band_and_evidence():
    report = sample_report()
    report["pillars"]["safety"] = {"applicability": "applies", "score": 40}
    assert errors_for(report), "a score with no findings is an opinion, not evidence"


def test_applicable_pillar_may_not_carry_a_rationale():
    report = sample_report()
    report["pillars"]["safety"] = {
        **scored_pillar(),
        "rationale": "not applicable, actually",
    }
    assert errors_for(report)


def test_excluded_pillars_are_recorded_on_the_composite():
    """A reader must be able to reconstruct the arithmetic and challenge the
    exclusions rather than trusting the headline number."""
    report = sample_report()
    report["pillars"]["viability"] = skipped_pillar()
    report["pillars"]["delegation"] = skipped_pillar(
        "The repository states no agent or AI workflow, so there is no delegation contract to audit."
    )
    report["composite"] = {
        "score": 72,
        "band": "great",
        "pillars_scored": ["blueprint", "resilience", "safety", "legibility"],
        "pillars_excluded": ["viability", "delegation"],
    }
    assert errors_for(report) == []


def test_composite_must_name_at_least_one_scored_pillar():
    report = sample_report()
    report["composite"]["pillars_scored"] = []
    assert errors_for(report)


def test_findings_require_a_verifiable_artifact():
    report = sample_report()
    bad = finding()
    bad["artifact"] = ""
    report["pillars"]["blueprint"]["findings"] = [bad]
    assert errors_for(report)


# ------------------------------------------------------------ the spectrum

@pytest.mark.parametrize("band", ["meh", "ok", "good", "great", "amazing", "moonshot"])
def test_every_spectrum_band_is_accepted(band):
    report = sample_report()
    report["pillars"]["blueprint"] = scored_pillar(band=band)
    report["composite"]["band"] = band
    assert errors_for(report) == []


def test_invented_bands_are_rejected():
    report = sample_report()
    report["composite"]["band"] = "legendary"
    assert errors_for(report)


# ------------------------------------------------- the disengagement protocol

def disengaged_report(**disengagement_overrides) -> dict:
    disengagement = {
        "reason": "apparent_personal_data",
        "disengaged_at": "2026-08-01T12:00:00Z",
    }
    disengagement.update(disengagement_overrides)
    return sample_report(
        pillars={name: skipped_pillar("Audit terminated before this pillar was evaluated.") for name in PILLARS},
        composite=None,
        comparison=None,
        disengagement=disengagement,
    )


def test_clean_disengagement_is_valid():
    assert errors_for(disengaged_report()) == []


@pytest.mark.parametrize(
    "leak_field",
    ["detail", "excerpt", "description", "path", "file", "evidence", "severity", "notes"],
)
def test_disengagement_cannot_describe_what_was_seen(leak_field):
    """No association. No continuation. No flagging. The protocol is enforced by
    the shape of the object, not by asking the agent nicely."""
    report = disengaged_report(**{leak_field: "redacted-but-still-a-leak"})
    assert errors_for(report), f"disengagement must reject a '{leak_field}' field"


def test_disengagement_reason_is_a_closed_vocabulary():
    assert errors_for(disengaged_report(reason="found_something_weird"))


def test_disengaged_audit_produces_no_composite():
    report = disengaged_report()
    report["composite"] = {
        "score": 10,
        "band": "meh",
        "pillars_scored": ["safety"],
        "pillars_excluded": [],
    }
    assert errors_for(report), "stopping means stopping"


def test_disengaged_audit_produces_no_comparison():
    report = disengaged_report()
    report["comparison"] = {
        "cohort_ref": "cohort-2026-08",
        "cohort_size": 12,
        "observations": [],
    }
    assert errors_for(report)


def test_completed_audit_may_not_omit_a_composite():
    """A report with neither a composite nor a disengagement is a silent
    failure, which is the one outcome this contract will not allow."""
    report = sample_report(composite=None)
    assert errors_for(report)


# --------------------------------------------------------------- comparison

def test_comparison_observations_require_an_artifact():
    report = sample_report()
    report["comparison"] = {
        "cohort_ref": "cohort-2026-08",
        "cohort_size": 12,
        "observations": [{"statement": "64% of comparable projects declare a schema first."}],
    }
    assert errors_for(report), "a comparison without a measurement reference is a rumour"


def test_comparison_with_artifact_is_valid():
    report = sample_report()
    report["comparison"] = {
        "cohort_ref": "cohort-2026-08",
        "cohort_size": 12,
        "observations": [
            {
                "statement": "64% of comparable projects declare a schema before generating code.",
                "artifact": "docs/audits/cohort-ledger.json#2026-08",
            }
        ],
    }
    assert errors_for(report) == []


# ------------------------------------------------------------------ subject

def test_subject_requires_an_immutable_commit():
    report = sample_report()
    report["subject"]["commit_sha"] = "main"
    assert errors_for(report), "a report must be re-derivable against the exact input"


def test_empty_prd_paths_is_legal_and_meaningful():
    """'There was no PRD here' is itself the finding, not a schema error."""
    report = sample_report()
    report["subject"]["prd_paths"] = []
    assert errors_for(report) == []
