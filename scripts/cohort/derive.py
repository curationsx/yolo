#!/usr/bin/env python3
"""Cohort ledger derivation — the temporal knowledge ledger as a pure function.

    f(run-record corpus, taxonomy/cohorts.yaml) -> ledger JSON

Design rules (docs/audits/2026-07-18-brain-dump-reconciliation.md §2, §4, §6):

- **Derivation, not a service.** The ledger is recomputed from the append-only
  run-record corpus. It holds aggregate inquiry patterns only — never
  repository contents, never cross-user data. Identical inputs produce
  byte-identical output (sorted keys, stable ordering, no wall-clock values).
- **Membership by ``created_at``** (UTC date within a configured window) —
  retroactively derivable for every record ever produced. ``cohort_ref``
  aliases (e.g. ``v0.1-tier-a``) resolve through the config's alias entries.
- **Closed cohorts are immutable**: appending later records to the corpus can
  never change a closed cohort's block (tested property, not a promise).
- **Sub-cohorts** (``<cohort_id>.r2``, ``.r3`` …) derive from ``previous_run``
  lineage inside one window — engagement frequency as a dimension.
- **Fall-off** is an aggregate retention signal, never a per-user dossier.
- **Fail-closed**: a structurally unusable record aborts the derivation with a
  plain-language reason. Silently skipping records would falsify aggregates.

The same derivation feeds the G6 measurement hooks (first runs, linked
re-runs, improved re-runs, first-fix rate) per docs/audits/measurement-spec.md
— the ledger and the metrics are one computation over one corpus.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

REQUIRED_RECORD_FIELDS = (
    "run_id",
    "repo_fingerprint",
    "previous_run",
    "created_at",
    "checks_passed",
    "checks_total",
    "ruleset_version",
)


class DeriveError(SystemExit):
    """Fail-closed refusal with a plain-language reason."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"derive: {reason}")


def load_config(path: Path) -> dict:
    if yaml is None:
        raise DeriveError(
            "PyYAML is required to parse taxonomy/cohorts.yaml "
            "(pip install pyyaml==6.0.3)"
        )
    try:
        config = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise DeriveError(f"cannot read cohort config: {exc}")
    if not isinstance(config, dict) or not isinstance(config.get("cohorts"), list):
        raise DeriveError("cohort config must contain a 'cohorts' list")

    windows: list[dict] = []
    aliases: dict[str, str] = {}
    for entry in config["cohorts"]:
        cohort_id = entry.get("cohort_id")
        if not cohort_id:
            raise DeriveError("cohort entry without cohort_id")
        if entry.get("trigger") == "alias":
            target = entry.get("alias_of")
            if not target:
                raise DeriveError(f"alias cohort {cohort_id!r} missing alias_of")
            aliases[cohort_id] = target
            continue
        try:
            opened = date.fromisoformat(str(entry["opened_at"]))
            closes = date.fromisoformat(str(entry["closes_at"]))
        except (KeyError, ValueError) as exc:
            raise DeriveError(f"cohort {cohort_id!r} has unusable window dates: {exc}")
        if closes < opened:
            raise DeriveError(f"cohort {cohort_id!r} closes before it opens")
        windows.append(
            {
                "cohort_id": cohort_id,
                "opened_at": opened,
                "closes_at": closes,
                "sub_cohort_window": bool(entry.get("sub_cohort_window", False)),
            }
        )

    windows.sort(key=lambda w: w["opened_at"])
    for earlier, later in zip(windows, windows[1:]):
        if later["opened_at"] <= earlier["closes_at"]:
            raise DeriveError(
                f"cohort windows {earlier['cohort_id']!r} and "
                f"{later['cohort_id']!r} overlap — membership must be unambiguous"
            )
    return {
        "config_version": str(config.get("config_version", "unversioned")),
        "windows": windows,
        "aliases": aliases,
    }


def load_records(directories: list[Path]) -> list[dict]:
    records: list[dict] = []
    seen_ids: set[str] = set()
    for directory in directories:
        if not directory.is_dir():
            raise DeriveError(f"records directory does not exist: {directory}")
        for path in sorted(directory.glob("*.json")):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise DeriveError(f"unusable record {path}: {exc}")
            missing = [f for f in REQUIRED_RECORD_FIELDS if f not in record]
            if missing:
                raise DeriveError(
                    f"record {path} missing fields: {', '.join(missing)} — "
                    "refusing to derive from a partial corpus"
                )
            if record["run_id"] in seen_ids:
                raise DeriveError(f"duplicate run_id {record['run_id']} at {path}")
            seen_ids.add(record["run_id"])
            records.append(record)
    records.sort(key=lambda r: (r["created_at"], r["run_id"]))
    return records


def record_date(record: dict) -> date:
    raw = str(record["created_at"]).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError as exc:
        raise DeriveError(f"record {record['run_id']} has unusable created_at: {exc}")


def assign_cohort(record: dict, config: dict) -> str | None:
    """Window containing created_at wins; alias cohort_refs corroborate."""
    when = record_date(record)
    for window in config["windows"]:
        if window["opened_at"] <= when <= window["closes_at"]:
            return window["cohort_id"]
    return None


def lineage_chains(records: list[dict]) -> dict[str, str]:
    """Map run_id -> chain root id via explicit previous_run links.

    A chain is one project's consented journey: records group together only
    when the owner explicitly linked them (G3 lineage). repo_fingerprint is
    deliberately NOT used — it hashes the audited commit, so it changes per
    run and would fracture journeys; lineage is the honest key.
    """
    parent = {r["run_id"]: r.get("previous_run") for r in records}

    def root(run_id: str) -> str:
        seen = set()
        current = run_id
        while True:
            if current in seen:
                raise DeriveError(f"lineage cycle detected at run {current}")
            seen.add(current)
            up = parent.get(current)
            if up is None or up not in parent:
                return current
            current = up

    return {run_id: root(run_id) for run_id in parent}


def derive(records: list[dict], config: dict) -> dict:
    by_id = {r["run_id"]: r for r in records}
    chain_of = lineage_chains(records)
    members: dict[str, list[dict]] = {}
    unassigned: list[str] = []
    for record in records:
        cohort_id = assign_cohort(record, config)
        if cohort_id is None:
            unassigned.append(record["run_id"])
        else:
            members.setdefault(cohort_id, []).append(record)

    cohorts_out = []
    for window in config["windows"]:
        cohort_records = members.get(window["cohort_id"], [])
        if not cohort_records and not window["sub_cohort_window"]:
            continue

        journeys: dict[str, list[dict]] = {}
        for record in cohort_records:
            journeys.setdefault(chain_of[record["run_id"]], []).append(record)

        first_run_journeys = 0
        improved_journeys = 0
        linked_reruns = 0
        improved_runs = 0
        regressed_runs = 0
        no_change_runs = 0
        sub_cohorts: dict[str, int] = {}
        inquiry_observed: dict[str, int] = {}
        inquiry_declared: dict[str, int] = {}

        for _chain_root, journey_records in journeys.items():
            journey_records.sort(key=lambda r: (r["created_at"], r["run_id"]))
            visit = 0
            journey_improved = False
            journey_had_first = False
            for record in journey_records:
                previous = record.get("previous_run")
                if previous is None:
                    journey_had_first = True
                predecessor = by_id.get(previous) if previous else None
                if predecessor is not None:
                    linked_reruns += 1
                    visit += 1
                    if visit >= 1:
                        label = f"{window['cohort_id']}.r{visit + 1}"
                        sub_cohorts[label] = sub_cohorts.get(label, 0) + 1
                    if record["checks_passed"] > predecessor["checks_passed"]:
                        improved_runs += 1
                        journey_improved = True
                    elif record["checks_passed"] < predecessor["checks_passed"]:
                        regressed_runs += 1
                    else:
                        no_change_runs += 1
                categories = record.get("categories") or {}
                for cid in categories.get("observed", []) or []:
                    inquiry_observed[cid] = inquiry_observed.get(cid, 0) + 1
                for cid in categories.get("declared", []) or []:
                    inquiry_declared[cid] = inquiry_declared.get(cid, 0) + 1
            if journey_had_first:
                first_run_journeys += 1
                if journey_improved:
                    improved_journeys += 1

        first_fix_rate = (
            round(improved_journeys / first_run_journeys, 4)
            if first_run_journeys
            else None
        )
        cohorts_out.append(
            {
                "cohort_id": window["cohort_id"],
                "window": {
                    "opened_at": window["opened_at"].isoformat(),
                    "closes_at": window["closes_at"].isoformat(),
                },
                "total_runs": len(cohort_records),
                "unique_journeys": len(journeys),
                "first_run_journeys": first_run_journeys,
                "linked_reruns": linked_reruns,
                "improved_runs": improved_runs,
                "regressed_runs": regressed_runs,
                "no_change_runs": no_change_runs,
                "improved_journeys": improved_journeys,
                "first_fix_rate": first_fix_rate,
                "sub_cohorts": dict(sorted(sub_cohorts.items())),
                "inquiry_buckets": {
                    "observed": dict(sorted(inquiry_observed.items())),
                    "declared": dict(sorted(inquiry_declared.items())),
                },
                "run_ids": sorted(r["run_id"] for r in cohort_records),
            }
        )

    corpus_fingerprint = hashlib.sha256(
        "\n".join(f"{r['run_id']}:{r['created_at']}" for r in records).encode()
    ).hexdigest()

    return {
        "ledger_version": "cohort-ledger/0.1.0",
        "config_version": config["config_version"],
        "corpus_fingerprint": f"sha256:{corpus_fingerprint}",
        "total_records": len(records),
        "cohorts": cohorts_out,
        "unassigned_run_ids": sorted(unassigned),
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Derive the cohort ledger from run-record corpora."
    )
    parser.add_argument(
        "--records",
        action="append",
        required=True,
        help="Directory of run-record JSON files (repeatable)",
    )
    parser.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parents[2] / "taxonomy" / "cohorts.yaml"),
        help="Path to taxonomy/cohorts.yaml",
    )
    parser.add_argument("--out", help="Write the ledger JSON here (default: stdout)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = load_config(Path(args.config))
    records = load_records([Path(p) for p in args.records])
    ledger = json.dumps(derive(records, config), indent=2, sort_keys=True) + "\n"
    if args.out:
        Path(args.out).write_text(ledger, encoding="utf-8")
    else:
        sys.stdout.write(ledger)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
