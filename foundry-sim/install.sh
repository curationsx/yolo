#!/usr/bin/env bash
# foundry-sim/install.sh — idempotent bootstrap for the foundry-sim offline emulator
#
# Usage (from anywhere in the repository):
#   bash foundry-sim/install.sh          # full check + smoke test
#   bash foundry-sim/install.sh --check  # prerequisite check only, no test run
#
# This script:
#   1. Verifies Python 3.9+ is available
#   2. Confirms all required source files are present
#   3. Validates fixture JSON files
#   4. Runs the full test suite (stdlib unittest, offline, no cost)
#   5. Runs a minimal smoke test of dash.py and FoundryClient
#
# No pip installs, no virtual environments, no sudo, no network calls.
# Safe to run repeatedly (idempotent).

set -euo pipefail

# ── helpers ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}[OK]${RESET}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }
fail() { echo -e "${RED}[FAIL]${RESET} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── argument handling ───────────────────────────────────────────────────────
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --help|-h)
      echo "Usage: bash foundry-sim/install.sh [--check]"
      echo ""
      echo "  (no flags)  Run prerequisite checks, fixture validation, test suite, and smoke test."
      echo "  --check     Run prerequisite checks only; skip tests."
      exit 0
      ;;
    *) fail "Unknown argument: $arg  (use --help for usage)" ;;
  esac
done

echo ""
echo "┌─ F O U N D R Y - S I M  bootstrap ─────────────────────────────────────┐"
echo "│  Offline emulator — stdlib only — no pip installs — no network calls    │"
echo "└─────────────────────────────────────────────────────────────────────────┘"
echo ""

# ── 1. Python version check ─────────────────────────────────────────────────
echo "Checking prerequisites..."

PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done

if [[ -z "$PYTHON" ]]; then
  fail "Python not found. Install Python 3.9 or newer and re-run.
  macOS:  brew install python@3.12
  Ubuntu: sudo apt-get install python3
  Windows: https://python.org/downloads"
fi

PYTHON_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$("$PYTHON" -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$("$PYTHON" -c "import sys; print(sys.version_info.minor)")

if [[ "$PYTHON_MAJOR" -lt 3 || ( "$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -lt 9 ) ]]; then
  fail "Python 3.9+ required; found $PYTHON_VERSION. Please upgrade Python."
fi
ok "Python $PYTHON_VERSION ($PYTHON)"

# ── 2. Required source files present ───────────────────────────────────────
echo ""
echo "Checking required source files..."

REQUIRED_FILES=(
  "foundry_client.py"
  "dash.py"
  "rates.json"
  "fixtures/strategy-brief.json"
  "fixtures/workflow-review.json"
  "fixtures/rubber-duck.json"
  "tests/test_sim.py"
)

all_present=1
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "${SCRIPT_DIR}/${f}" ]]; then
    ok "${f}"
  else
    warn "Missing: ${f}"
    all_present=0
  fi
done

if [[ "$all_present" -eq 0 ]]; then
  fail "One or more required files are missing. Check the repository checkout."
fi

# ── 3. Validate fixture JSON ────────────────────────────────────────────────
echo ""
echo "Validating fixture JSON files..."

FOUNDRY_SIM_DIR="$SCRIPT_DIR" "$PYTHON" - <<'PYEOF'
import json, os, sys
from pathlib import Path

fixtures_dir = Path(os.environ["FOUNDRY_SIM_DIR"]) / "fixtures"

ok = True
for path in sorted(fixtures_dir.glob("*.json")):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        required = {"id", "response"}
        missing = required - data.keys()
        if missing:
            print(f"  [WARN] {path.name}: missing keys {missing}")
            ok = False
        elif "choices" not in data.get("response", {}):
            print(f"  [WARN] {path.name}: response missing 'choices'")
            ok = False
        else:
            print(f"  [OK]   {path.name}")
    except json.JSONDecodeError as e:
        print(f"  [FAIL] {path.name}: invalid JSON — {e}")
        ok = False

if not ok:
    sys.exit(1)
PYEOF

# ── 4. Module import smoke test ─────────────────────────────────────────────
echo ""
echo "Running import smoke test..."

"$PYTHON" - <<PYEOF
import sys
sys.path.insert(0, "$SCRIPT_DIR")
try:
    from foundry_client import FoundryClient
    print("  [OK]   foundry_client import")
except Exception as e:
    print(f"  [FAIL] foundry_client import: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import dash  # noqa: F401 — presence check only
    print("  [OK]   dash import")
except Exception as e:
    print(f"  [FAIL] dash import: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo ""
  ok "Prerequisite check complete (--check mode; tests skipped)."
  exit 0
fi

# ── 5. Full test suite ──────────────────────────────────────────────────────
echo ""
echo "Running test suite (foundry-sim/tests/test_sim.py)..."
echo ""

"$PYTHON" -m unittest "${SCRIPT_DIR}/tests/test_sim.py" -v 2>&1

# ── 6. Minimal smoke test ───────────────────────────────────────────────────
echo ""
echo "Running dash.py smoke test (no-network, no-cost)..."

"$PYTHON" "${SCRIPT_DIR}/dash.py" > /dev/null
ok "dash.py smoke test passed"

echo ""
echo "Running FoundryClient end-to-end smoke test..."

"$PYTHON" - <<PYEOF
import sys
sys.path.insert(0, "$SCRIPT_DIR")
from foundry_client import FoundryClient

client = FoundryClient()
resp = client.chat(
    [{"role": "user", "content": "Help me frame a strategy brief."}],
    record_to_ledger=False,
)
assert "choices" in resp, "Missing 'choices' in response"
assert "sim_note" in resp, "Missing 'sim_note' in response"
assert "SIMULATED" in resp["sim_note"], "sim_note should contain 'SIMULATED'"
content = resp["choices"][0]["message"]["content"]
assert isinstance(content, str) and len(content) > 0, "Empty response content"
print("  [OK]   FoundryClient.chat smoke test passed")
PYEOF

# ── done ────────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────────────────────────────┐"
echo "│  foundry-sim bootstrap complete — all checks passed                     │"
echo "│                                                                          │"
echo "│  Quick start:                                                            │"
echo "│    python foundry-sim/dash.py          # terminal dashboard              │"
echo "│    python foundry-sim/dash.py --demo   # add demo runs then display      │"
echo "└─────────────────────────────────────────────────────────────────────────┘"
echo ""
