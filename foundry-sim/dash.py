#!/usr/bin/env python3
"""dash.py — Foundry Simulator terminal dashboard.

Standard-library-only. No network calls. No cost. Offline only.

Prints:
  - Emulated deployment / persona topology
  - Per-run simulated token counts from ledger.json
  - A projected cost / ROI table (clearly labeled ESTIMATE)

Usage:
    python foundry-sim/dash.py

Environment:
    FOUNDRY_MODE  — must be 'sim' (default) or omit. 'azure' will show an error.
    SIM_PROFILE   — default 'auto'. Displayed in topology panel.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_LEDGER_PATH = _HERE / "ledger.json"
_RATES_PATH = _HERE / "rates.json"
_PERSONAS_DIR = _HERE / "personas"
_WORKFLOWS_DIR = _HERE / "workflows"
_FIXTURES_DIR = _HERE / "fixtures"

# ── Box-drawing constants ───────────────────────────────────────────────────
W = 72  # total box width (inner)
_VALID_EXTENSIONS = {".json", ".yml", ".yaml"}
_HIDDEN_PREFIX = "_"


def _box(title: str, lines: list[str], width: int = W) -> str:
    inner = width - 2  # space inside the border
    top = "┌" + "─" * inner + "┐"
    label = f"│  {title:<{inner - 2}}│"
    sep = "├" + "─" * inner + "┤"
    bottom = "└" + "─" * inner + "┘"
    body = [f"│  {ln:<{inner - 2}}│" for ln in lines]
    return "\n".join([top, label, sep] + body + [bottom])


def _header() -> str:
    lines = [
        "┌─ F O U N D R Y - S I M  //  A o T  C O M M U N I T Y ─────────────┐",
        "│  LOCAL OFFLINE EMULATOR  ×  ZERO COST  ×  NO NETWORK CALLS         │",
        "│  FOUNDRY_MODE=sim  ·  All figures labeled ESTIMATE                 │",
        "└──────────────────────────────────────────[ SIM → REAL = config ]───┘",
    ]
    return "\n".join(lines)


# ── Data loaders ────────────────────────────────────────────────────────────

def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def _list_yaml_or_json_names(directory: Path) -> list[str]:
    if not directory.exists():
        return []
    names = []
    for p in sorted(directory.iterdir()):
        if p.is_file() and p.suffix in _VALID_EXTENSIONS and not p.name.startswith(_HIDDEN_PREFIX):
            names.append(p.stem)
    return names


# ── Panel builders ──────────────────────────────────────────────────────────

def _topology_panel(profile: str, personas: list[str], workflows: list[str], fixtures: list[str]) -> str:
    lines = [
        f"Mode         : sim (offline emulator)",
        f"Profile      : {profile}",
        f"Auto-routing : enabled — model selection deferred to Copilot auto engine",
        "",
        f"Personas loaded  ({len(personas)}):  " + (", ".join(personas) if personas else "(none — add to personas/)"),
        f"Workflows loaded ({len(workflows)}): " + (", ".join(workflows) if workflows else "(none — add to workflows/)"),
        f"Fixtures loaded  ({len(fixtures)}):  " + (", ".join(fixtures) if fixtures else "(none — add to fixtures/)"),
        "",
        "AoT Loop:",
        "  Intent → Context → Compose → Act → Verify → Learn",
        "       ↑                                          │",
        "       └──────────────────────────────────────────┘",
        "",
        "Seven AoT elements: People · Context · Models · Tools",
        "                    Evidence · Controls · Feedback",
    ]
    return _box("EMULATED DEPLOYMENT TOPOLOGY", lines)


def _runs_panel(runs: list[dict]) -> str:
    if not runs:
        lines = [
            "No runs recorded yet.",
            "Run: python foundry-sim/dash.py --demo   (or import FoundryClient and call .chat())",
        ]
        return _box("PER-RUN SIMULATED TOKEN COUNTS", lines)

    lines = [f"{'Run':<4} {'Timestamp':<22} {'Model':<12} {'Prompt':>7} {'Compl':>6} {'Total':>6}"]
    lines.append("─" * (W - 4))
    for i, run in enumerate(runs[-10:], 1):  # last 10
        ts = run.get("timestamp", "")[:19]
        model = run.get("model", "auto")[:11]
        pt = run.get("prompt_tokens", 0)
        ct = run.get("completion_tokens", 0)
        tt = run.get("total_tokens", 0)
        lines.append(f"{i:<4} {ts:<22} {model:<12} {pt:>7} {ct:>6} {tt:>6}")
    if len(runs) > 10:
        lines.append(f"  … and {len(runs) - 10} earlier run(s). See ledger.json for full history.")
    return _box("PER-RUN SIMULATED TOKEN COUNTS  (last 10)", lines)


def _roi_panel(runs: list[dict], rates: dict) -> str:
    if not runs:
        lines = [
            "No runs recorded. Complete a sim run to populate cost projections.",
        ]
        return _box("PROJECTED COST / ROI TABLE  ★ ESTIMATE ★", lines)

    total_tokens = sum(r.get("total_tokens", 0) for r in runs)
    total_cost = sum(r.get("estimated_cost_usd", 0.0) for r in runs)
    n = len(runs)
    avg_cost = total_cost / n if n else 0

    currency = rates.get("currency", "USD")
    model_rows = rates.get("models", {})

    lines = [
        "★ All figures are ESTIMATES. Not connected to Azure billing. ★",
        "",
        f"Total sim runs           : {n}",
        f"Total simulated tokens   : {total_tokens:,}",
        f"Total estimated cost     : {currency} {total_cost:.6f}",
        f"Average cost / run       : {currency} {avg_cost:.6f}",
        "",
        "Rate card used (ESTIMATE from rates.json):",
    ]
    for key, m in model_rows.items():
        inp = m.get("input", 0)
        out = m.get("output", 0)
        label = m.get("label", key)[:40]
        lines.append(f"  {key:<12}  in=${inp:.5f}/1k  out=${out:.5f}/1k  [{label}]")

    lines += [
        "",
        "Startup Credits guardrail: first-party Azure OpenAI models only.",
        "Third-party/Marketplace models in Foundry do NOT count against credits.",
        "See docs/PRD-azure-foundry-integration.md for the full allowlist design.",
        "",
        "To project monthly spend: multiply avg cost/run × expected runs/month.",
    ]
    return _box("PROJECTED COST / ROI TABLE  ★ ESTIMATE ★", lines)


def _footer() -> str:
    return (
        "  Switch to real Azure: set FOUNDRY_MODE=azure and follow PRD-azure-foundry-integration.md\n"
        "  The interface is identical — same client.chat() calls, same response shape.\n"
        "  No code changes required when you're ready to connect."
    )


# ── Demo run ─────────────────────────────────────────────────────────────────

def _run_demo() -> None:
    """Add a couple of demo ledger entries so the dashboard has something to display."""
    sys.path.insert(0, str(_HERE.parent / "foundry-sim"))
    # Re-import relative to foundry-sim dir
    import importlib.util
    spec = importlib.util.spec_from_file_location("foundry_client", _HERE / "foundry_client.py")
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    client = mod.FoundryClient()
    client.chat([{"role": "user", "content": "Help me frame a discovery brief for a new platform."}])
    client.chat([{"role": "user", "content": "Review this workflow for missing checkpoints."}])
    client.chat([{"role": "user", "content": "My pagination function returns wrong page on third call."}])
    print("Demo: 3 simulated runs added to ledger.json.")


# ── Main ─────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]

    mode = os.environ.get("FOUNDRY_MODE", "sim").lower().strip()
    profile = os.environ.get("SIM_PROFILE", "auto")

    if mode == "azure":
        print(
            "ERROR: FOUNDRY_MODE=azure is not enabled in this build.\n"
            "This dashboard runs the local offline simulator only.\n"
            "See docs/PRD-azure-foundry-integration.md for the real integration design."
        )
        return 1

    if "--demo" in argv or "-d" in argv:
        _run_demo()

    ledger = _load_json(_LEDGER_PATH)
    rates = _load_json(_RATES_PATH)
    runs = ledger.get("runs", [])
    personas = _list_yaml_or_json_names(_PERSONAS_DIR)
    workflows = _list_yaml_or_json_names(_WORKFLOWS_DIR)
    fixtures = _list_yaml_or_json_names(_FIXTURES_DIR)

    print()
    print(_header())
    print()
    print(_topology_panel(profile, personas, workflows, fixtures))
    print()
    print(_runs_panel(runs))
    print()
    print(_roi_panel(runs, rates))
    print()
    print(_footer())
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
