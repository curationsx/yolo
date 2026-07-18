#!/usr/bin/env python3
"""Validate run-record JSON files against the run-record schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "run-record.schema.json"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a run-record JSON file against schemas/run-record.schema.json."
    )
    parser.add_argument("record", nargs="?", default="-", help="Path to a JSON file, or '-' for stdin")
    return parser.parse_args(argv)


def load_json_document(path_or_dash: str) -> dict:
    if path_or_dash == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path_or_dash).read_text(encoding="utf-8"))


def validate_record(record: dict) -> list[str]:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(record), key=lambda error: list(error.path))
    problems: list[str] = []
    for error in errors:
        location = "/".join(str(part) for part in error.path) or "$"
        problems.append(f"{location}: {error.message}")
    return problems


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    record = load_json_document(args.record)
    problems = validate_record(record)
    if problems:
        for problem in problems:
            print(problem)
        return 1

    print("run-record is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
