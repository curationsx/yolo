#!/usr/bin/env bash
# scripts/azure/build-images.sh
#
# Builds the gateway and Copilot runtime container images remotely with
# `az acr build` (ACR Tasks). No local Docker daemon is required or used.
# Images are tagged with the immutable, committed Git SHA so every deployed
# artifact traces back to source control (plan Acceptance Criteria #20).
#
# Usage:
#   scripts/azure/build-images.sh [--apply] [--acr <name>] [--sha <sha>]
#                                  [--gateway-only] [--copilot-only]
#                                  [--registry-login-server <fqdn>] [--json]
#
# Default mode prints the exact `az acr build` invocations without running
# them. Pass --apply to actually submit the remote builds. The script always
# refuses to run against an uncommitted working tree, and always refuses to
# invent a SHA -- it reads HEAD from git unless --sha is given explicitly
# (only intended for CI re-runs against an already-verified commit).
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=lib/config.sh
source "${SCRIPT_DIR}/lib/config.sh"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

APPLY=0
ACR_NAME="${YOLO_ACR_NAME}"
SHA_OVERRIDE=""
GATEWAY_ONLY=0
COPILOT_ONLY=0
JSON_OUTPUT=0

GATEWAY_CONTEXT="${REPO_ROOT}/agent-worker"
GATEWAY_DOCKERFILE="Dockerfile.azure"
GATEWAY_IMAGE_REPO="yolo/gateway"

COPILOT_CONTEXT="${REPO_ROOT}/agent-worker/copilot-runtime"
COPILOT_DOCKERFILE="Dockerfile"
COPILOT_IMAGE_REPO="yolo/copilot-runtime"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--apply] [--acr <name>] [--sha <sha>]
                        [--gateway-only] [--copilot-only]
                        [--registry-login-server <fqdn>] [--json] [--help]

Builds container images with 'az acr build'. Dry run by default; pass
--apply to submit the remote builds.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --acr)
      require_flag_value "--acr" "${2-}"
      ACR_NAME="$2"; shift 2 ;;
    --sha)
      require_flag_value "--sha" "${2-}"
      SHA_OVERRIDE="$2"; shift 2 ;;
    --gateway-only) GATEWAY_ONLY=1; shift ;;
    --copilot-only) COPILOT_ONLY=1; shift ;;
    --json) JSON_OUTPUT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

if [[ "$GATEWAY_ONLY" == "1" && "$COPILOT_ONLY" == "1" ]]; then
  die "--gateway-only and --copilot-only are mutually exclusive"
fi

resolve_sha() {
  if [[ -n "$SHA_OVERRIDE" ]]; then
    if ! [[ "$SHA_OVERRIDE" =~ ^[0-9a-f]{7,40}$ ]]; then
      die "--sha must be a hex git commit SHA, got: $SHA_OVERRIDE"
    fi
    printf '%s\n' "$SHA_OVERRIDE"
    return
  fi
  current_git_sha "$REPO_ROOT"
}

build_one() {
  local label="$1" context="$2" dockerfile="$3" repo="$4" sha="$5"
  local image_ref="${ACR_NAME}.azurecr.io/${repo}:${sha}"

  if [[ ! -d "$context" ]]; then
    die "$label build context not found at $context"
  fi
  if [[ ! -f "${context}/${dockerfile}" ]]; then
    log_warn "$label Dockerfile not found yet at ${context}/${dockerfile} -- this lane may still be pending (agent-worker/ image work)."
  fi

  local cmd=(az acr build
    --registry "$ACR_NAME"
    --image "${repo}:${sha}"
    --file "$dockerfile"
    "$context")

  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "$label image build -> $image_ref"
    log_info "Would run: $(join_spaces "${cmd[@]}")"
    printf '%s\n' "$image_ref"
    return
  fi

  log_step "Building $label image -> $image_ref"
  "${cmd[@]}"
  log_info "$label image built: $image_ref"
  printf '%s\n' "$image_ref"
}

main() {
  require_cmd az
  local sha
  sha="$(resolve_sha)"
  log_info "Using immutable image tag (git SHA): $sha"

  local gateway_ref="" copilot_ref=""

  if [[ "$COPILOT_ONLY" != "1" ]]; then
    gateway_ref="$(build_one "gateway" "$GATEWAY_CONTEXT" "$GATEWAY_DOCKERFILE" "$GATEWAY_IMAGE_REPO" "$sha")"
  fi
  if [[ "$GATEWAY_ONLY" != "1" ]]; then
    copilot_ref="$(build_one "copilot-runtime" "$COPILOT_CONTEXT" "$COPILOT_DOCKERFILE" "$COPILOT_IMAGE_REPO" "$sha")"
  fi

  if [[ "$JSON_OUTPUT" == "1" ]]; then
    printf '{"sha":"%s","gatewayImage":"%s","copilotImage":"%s","applied":%s}\n' \
      "$sha" "$gateway_ref" "$copilot_ref" \
      "$( [[ $APPLY -eq 1 ]] && echo true || echo false )"
  fi
}

main "$@"
