#!/usr/bin/env python3
"""Truthful delta between two Tier A run-records (Lane E).

Given a current record and its predecessor, report exactly which checks
changed — nothing more. Identical outcomes produce ``no change``; the tool
never manufactures improvement. Deltas are only computed between records
whose ``ruleset_version`` matches and whose lineage is explicit
(``current.previous_run == previous.run_id``): comparing runs under
different rules, or unrelated runs, would not be a truthful comparison.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED_FIELDS = ("run_id", "findings", "ruleset_version", "previous_run")


class DeltaError(SystemExit):
    """Fail-closed refusal with a plain-language reason."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"delta: {reason}")


def load_record(path: Path) -> dict:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DeltaError(f"cannot read run-record: {exc}")
    missing = [field for field in REQUIRED_FIELDS if field not in record]
    if missing:
        raise DeltaError(f"run-record missing fields: {', '.join(missing)}")
    return record


def outcomes(record: dict) -> dict[str, bool]:
    """Map check_id -> passed for a record's findings."""
    result: dict[str, bool] = {}
    for finding in record["findings"]:
        check_id = finding.get("check_id")
        passed = finding.get("passed")
        if not isinstance(check_id, str) or not isinstance(passed, bool):
            raise DeltaError("finding without usable check_id/passed")
        result[check_id] = passed
    return result


def compute_delta(current: dict, previous: dict) -> dict:
    """Pure truthful comparison — the Lane E falsifying-proof target.

    Returns a dict with:
      no_change: True when every check outcome is identical;
      fixed:     check_ids that flipped fail -> pass;
      regressed: check_ids that flipped pass -> fail;
      added / removed: check_ids present in only one record.
    """
    if current.get("previous_run") != previous.get("run_id"):
        raise DeltaError(
            "lineage mismatch: current.previous_run "
            f"({current.get('previous_run')!r}) does not reference the "
            f"previous record's run_id ({previous.get('run_id')!r})"
        )
    if current.get("ruleset_version") != previous.get("ruleset_version"):
        raise DeltaError(
            "ruleset mismatch: refusing to compare "
            f"{previous.get('ruleset_version')!r} against "
            f"{current.get('ruleset_version')!r} — a delta across rulesets "
            "would not be truthful"
        )

    now = outcomes(current)
    before = outcomes(previous)
    fixed = sorted(c for c in now if c in before and now[c] and not before[c])
    regressed = sorted(c for c in now if c in before and not now[c] and before[c])
    added = sorted(c for c in now if c not in before)
    removed = sorted(c for c in before if c not in now)
    no_change = not (fixed or regressed or added or removed)
    return {
        "current_run": current["run_id"],
        "previous_run": previous["run_id"],
        "ruleset_version": current["ruleset_version"],
        "no_change": no_change,
        "fixed": fixed,
        "regressed": regressed,
        "added": added,
        "removed": removed,
    }


def format_delta(delta: dict) -> str:
    """One honest line, count-form, no adjectives."""
    if delta["no_change"]:
        return f"no change vs run {delta['previous_run'][:8]}"
    parts: list[str] = []
    if delta["fixed"]:
        parts.append("+" + " +".join(delta["fixed"]))
    if delta["regressed"]:
        parts.append("-" + " -".join(delta["regressed"]))
    if delta["added"]:
        parts.append("new: " + ", ".join(delta["added"]))
    if delta["removed"]:
        parts.append("dropped: " + ", ".join(delta["removed"]))
    return f"{' · '.join(parts)} vs run {delta['previous_run'][:8]}"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Report the truthful delta between a run-record and its predecessor."
    )
    parser.add_argument("current", help="Path to the newer run-record JSON")
    parser.add_argument("previous", help="Path to the predecessor run-record JSON")
    parser.add_argument("--json", action="store_true", help="Emit the delta as JSON")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    delta = compute_delta(load_record(Path(args.current)), load_record(Path(args.previous)))
    if args.json:
        sys.stdout.write(json.dumps(delta, indent=2, sort_keys=True) + "\n")
    else:
        sys.stdout.write(format_delta(delta) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
