#!/usr/bin/env python3
"""Count-form badge generator for Tier A run-records (Lane C).

Reads a schema-valid run-record JSON and emits:
  1. a deterministic SVG badge — byte-identical output for identical input;
  2. a copy-paste README markdown snippet linking back to the public display.

The badge carries the count-form phrase only — ``Tier A: 7/7 · hygiene/0.1.0``.
Quality labels (gold/silver/bronze, scores, grades) are frozen out of v0.1 and
must never appear here. Determinism is by construction: no timestamps, no
randomness, no environment-dependent values enter the SVG.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Palette mirrors catalog-site/src/styles/global.css tokens (Visual Oracle).
INK = "#1a1614"          # --editorial-ink
PAPER = "#faf7f2"        # --editorial-paper
LIME = "#ebf998"         # --energetic-lime (--ok-bg)
CORAL = "#ff3131"        # --coral-red
MONO = "JetBrains Mono, IBM Plex Mono, ui-monospace, Courier New, monospace"

# Public display the badge links back to (Lane B homepage).
DISPLAY_URL = "https://curations.dev/"
BADGE_PATH_PREFIX = "badges/"

CHAR_W = 7.3          # monospace advance at font-size 12 — fixed, not measured
PAD_X = 10            # horizontal padding inside each segment
HEIGHT = 28           # badge height
SHADOW = 3            # hard shadow offset, no blur (Visual Oracle)
BORDER = 2            # primary border width

REQUIRED_FIELDS = (
    "run_id",
    "checks_passed",
    "checks_total",
    "ruleset_version",
    "commit_sha",
)


def load_record(path: Path) -> dict:
    """Load a run-record, failing closed on unusable input."""
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"badge: cannot read run-record: {exc}")
    missing = [field for field in REQUIRED_FIELDS if field not in record]
    if missing:
        raise SystemExit(f"badge: run-record missing fields: {', '.join(missing)}")
    if not isinstance(record["checks_passed"], int) or not isinstance(record["checks_total"], int):
        raise SystemExit("badge: checks_passed/checks_total must be integers")
    if record["checks_passed"] < 0 or record["checks_total"] <= 0:
        raise SystemExit("badge: check counts out of range")
    if record["checks_passed"] > record["checks_total"]:
        raise SystemExit("badge: checks_passed exceeds checks_total")
    return record


def count_form(record: dict) -> str:
    """The only sanctioned quality claim in v0.1."""
    return (
        f"Tier A: {record['checks_passed']}/{record['checks_total']}"
        f" · {record['ruleset_version']}"
    )


def _segment_width(text: str) -> float:
    return round(len(text) * CHAR_W + 2 * PAD_X, 1)


def render_svg(record: dict) -> str:
    """Render the badge. Pure function of the record — nothing else."""
    label = "TIER A"
    counts = f"{record['checks_passed']}/{record['checks_total']}"
    ruleset = record["ruleset_version"]
    all_passed = record["checks_passed"] == record["checks_total"]
    count_bg = LIME if all_passed else PAPER

    label_w = _segment_width(label)
    counts_w = _segment_width(counts)
    ruleset_w = _segment_width(ruleset)
    width = round(label_w + counts_w + ruleset_w, 1)
    total_w = round(width + SHADOW, 1)
    total_h = HEIGHT + SHADOW

    def text_x(offset: float, segment_w: float) -> float:
        return round(offset + segment_w / 2, 1)

    text_y = HEIGHT / 2 + 4.5  # optical centre for 12px mono

    title = count_form(record)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" role="img" aria-label="{title}">
  <title>{title}</title>
  <rect x="{SHADOW}" y="{SHADOW}" width="{width}" height="{HEIGHT}" fill="{INK}"/>
  <rect x="0" y="0" width="{width}" height="{HEIGHT}" fill="{PAPER}" stroke="{INK}" stroke-width="{BORDER}"/>
  <rect x="0" y="0" width="{label_w}" height="{HEIGHT}" fill="{INK}"/>
  <rect x="{label_w}" y="0" width="{counts_w}" height="{HEIGHT}" fill="{count_bg}" stroke="{INK}" stroke-width="1"/>
  <g font-family="{MONO}" font-size="12" text-anchor="middle">
    <text x="{text_x(0, label_w)}" y="{text_y}" fill="{PAPER}" font-weight="700">{label}</text>
    <text x="{text_x(label_w, counts_w)}" y="{text_y}" fill="{INK}" font-weight="700">{counts}</text>
    <text x="{text_x(label_w + counts_w, ruleset_w)}" y="{text_y}" fill="{INK}">{ruleset}</text>
  </g>
</svg>
"""


def render_markdown(record: dict) -> str:
    """README snippet: badge image linking back to the public display."""
    svg_url = f"{DISPLAY_URL}{BADGE_PATH_PREFIX}{record['run_id']}.svg"
    return f"[![{count_form(record)}]({svg_url})]({DISPLAY_URL})"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate the deterministic count-form badge for a run-record."
    )
    parser.add_argument("record", help="Path to the run-record JSON")
    parser.add_argument("--svg-out", help="Path to write the SVG badge")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    record = load_record(Path(args.record))
    svg = render_svg(record)
    if args.svg_out:
        Path(args.svg_out).write_text(svg, encoding="utf-8")
    sys.stdout.write(render_markdown(record) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
