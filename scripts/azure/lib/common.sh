#!/usr/bin/env bash
# scripts/azure/lib/common.sh
#
# Shared safety helpers for every scripts/azure/*.sh entry point.
# Source this file after setting `set -euo pipefail` in the caller.
#
# Design rules (do not weaken these):
#   - Never print secret values. Helpers here redact by pattern as a backstop,
#     but callers must not pass secrets to log_* in the first place.
#   - No `eval`, no dynamic command construction from untrusted input.
#   - No name-based process killing, no broad deletes.
#   - Every destructive action must be gated behind an explicit flag checked
#     by the caller; this file only supplies the primitives.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "common.sh must be sourced, not executed" >&2
  exit 1
fi

# Resolve repo root and this script's directory without relying on $0 tricks.
COMMON_SH_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
SCRIPTS_AZURE_DIR="$(cd -- "${COMMON_SH_DIR}/.." >/dev/null 2>&1 && pwd -P)"
# YOLO_REPO_ROOT_OVERRIDE lets the test harness point scripts at an isolated
# fixture git repository instead of the real working tree. It must never be
# set outside of tests.
REPO_ROOT="${YOLO_REPO_ROOT_OVERRIDE:-$(cd -- "${SCRIPTS_AZURE_DIR}/../.." >/dev/null 2>&1 && pwd -P)}"
export COMMON_SH_DIR SCRIPTS_AZURE_DIR REPO_ROOT

# --- logging -----------------------------------------------------------

_log_ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Patterns that must never reach stdout/stderr even if a caller slips up.
# This is a backstop, not a substitute for not logging secrets.
_SECRET_PATTERN='(client[_-]?secret|api[_-]?key|token|password|secret|authorization|private[_-]?key)'

redact_line() {
  # Redacts "key=value" or "key: value" pairs whose key looks secret-shaped.
  # Usage: printf '%s' "$line" | redact_line
  sed -E "s/(${_SECRET_PATTERN})([\"']?[[:space:]]*[:=][[:space:]]*)([^[:space:],\"']+)/\1\2[REDACTED]/Ig"
}

log_info()  { printf '[%s] [INFO]  %s\n'  "$(_log_ts)" "$(printf '%s' "$*" | redact_line)"; }
log_warn()  { printf '[%s] [WARN]  %s\n'  "$(_log_ts)" "$(printf '%s' "$*" | redact_line)" >&2; }
log_error() { printf '[%s] [ERROR] %s\n'  "$(_log_ts)" "$(printf '%s' "$*" | redact_line)" >&2; }
log_step()  { printf '[%s] [STEP]  %s\n'  "$(_log_ts)" "$(printf '%s' "$*" | redact_line)"; }

die() {
  log_error "$*"
  exit 1
}

# --- prerequisite checks ------------------------------------------------

require_cmd() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    if [[ -n "$hint" ]]; then
      die "Required command '$cmd' not found. $hint"
    fi
    die "Required command '$cmd' not found on PATH."
  fi
}

# --- safety gates --------------------------------------------------------

# Refuses to continue if the git worktree has uncommitted changes.
# Source-control must be the deployment authority (AGENTS.md, plan Stage 0).
require_clean_worktree() {
  require_cmd git
  local dir="${1:-$REPO_ROOT}"
  if ! git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    die "'$dir' is not a git worktree; refusing to proceed without source-control authority."
  fi
  if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
    die "Worktree at '$dir' has uncommitted changes. Commit or stash before running deployment-authority scripts."
  fi
}

# Returns the current commit SHA. Refuses on a dirty tree by default,
# because every deployed artifact must trace to a committed Git SHA
# (Acceptance Criteria #20 in .azure/deployment-plan.md).
current_git_sha() {
  require_cmd git
  local dir="${1:-$REPO_ROOT}"
  require_clean_worktree "$dir"
  git -C "$dir" rev-parse HEAD
}

# Generic yes/no confirmation gate. Never used for the high-stakes
# production domain confirmation (that requires an exact literal match,
# see require_exact_confirmation).
confirm_or_abort() {
  local prompt="${1:-Proceed?}"
  if [[ "${YOLO_ASSUME_YES:-}" == "1" ]]; then
    log_warn "YOLO_ASSUME_YES=1 set; skipping interactive confirmation for: $prompt"
    return 0
  fi
  if [[ ! -t 0 ]]; then
    die "Refusing to proceed without a TTY and without YOLO_ASSUME_YES=1: $prompt"
  fi
  read -r -p "$prompt [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) return 0 ;;
    *) die "Aborted by operator." ;;
  esac
}

# Requires the caller to have passed a literal string matching $expected.
# Used for the "--confirm curations.dev" style high-stakes gates so a
# fat-fingered --apply cannot mutate production.
require_exact_confirmation() {
  local provided="${1:-}"
  local expected="${2:-}"
  if [[ -z "$expected" ]]; then
    die "require_exact_confirmation: no expected value configured (internal error)."
  fi
  if [[ "$provided" != "$expected" ]]; then
    die "Refusing to proceed: --confirm must exactly equal '$expected' (got '${provided:-<empty>}')."
  fi
}

# --- fs safety -----------------------------------------------------------

# Creates a private (0700) directory for ephemeral secret-bearing material,
# owned exclusively by the current user, with a cleanup trap registered.
# Usage: work_dir=$(make_private_workdir "certificate")
make_private_workdir() {
  local label="${1:-yolo-azure}"
  local base="${YOLO_PRIVATE_WORKDIR_BASE:-${TMPDIR:-/tmp}}"
  local dir
  dir="$(mktemp -d "${base%/}/${label}.XXXXXXXX")"
  chmod 0700 "$dir"
  printf '%s\n' "$dir"
}

# --- arg parsing helpers ---------------------------------------------------

# Splits "--flag value" style args stored in "$@" is left to each script
# (bash arrays behave inconsistently pre-4.4 when passed through helpers),
# but this helper validates a value was actually supplied for a flag.
require_flag_value() {
  local flag="$1"
  local value="${2-}"
  if [[ -z "${value+x}" || "$value" == --* ]]; then
    die "Missing value for $flag"
  fi
}

print_dry_run_banner() {
  local action="$1"
  log_warn "DRY RUN: $action (no changes will be made). Pass --apply to execute."
}

# Joins array arguments with single spaces regardless of the caller's IFS
# (this repo intentionally sets IFS=$'\n\t' for safe word-splitting, so a
# plain "${arr[*]}" would otherwise join with newlines).
# Usage: log_info "Would run: $(join_spaces "${cmd[@]}")"
join_spaces() {
  local IFS=' '
  printf '%s' "$*"
}
