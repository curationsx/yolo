#!/usr/bin/env bash
# scripts/azure/deploy.sh
#
# Contributor-scoped runtime deployment: repeatable application deployment
# only. This script must NEVER invoke Owner bootstrap (infra/bootstrap.bicep)
# -- it only applies infra/runtime.bicep and publishes already-built,
# immutable image references plus the Astro static site artifact.
#
# Gateway verification (--verify-gateway): the staging gateway's ingress is
# restricted to Wyatt's IP only (plan Sec. "Network boundaries"). This
# script therefore NEVER performs a direct external HTTP call to the
# gateway itself -- not even for a post-deploy health check -- because a
# GitHub-hosted (or any non-whitelisted) runner would either be blocked
# outright or, worse, tempt someone into weakening that ingress rule to
# "make CI work". Instead, --verify-gateway triggers the `caj-yolo-ops`
# Container Apps Job (`az containerapp job start`), which runs *inside* the
# same Container Apps environment and can reach the gateway without
# touching the public IP restriction at all, then polls the job execution
# to completion. For any check that genuinely needs to run from outside
# Azure (the public Static Web Apps site, or an operator explicitly working
# from an allow-listed IP), use scripts/azure/verify.mjs directly instead.
#
# Usage:
#   scripts/azure/deploy.sh --gateway-image <ref> --copilot-image <ref>
#                            [--apply] [--sha <sha>] [--site-dist <path>]
#                            [--swa-deployment-token-env <VAR_NAME>]
#                            [--environment azure-staging|production]
#                            [--verify-gateway] [--gateway-verify-timeout <secs>] [--gateway-verify-poll-interval <secs>]
#                            [--json]
#
# Default mode is a dry run that prints the exact `az containerapp update`
# and static site publish commands without executing them. Pass --apply to
# execute. The script refuses to run against an uncommitted working tree and
# refuses image references that are not tagged with a full commit SHA.
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=lib/config.sh
source "${SCRIPT_DIR}/lib/config.sh"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

APPLY=0
GATEWAY_IMAGE=""
COPILOT_IMAGE=""
SHA_OVERRIDE=""
SITE_DIST="${REPO_ROOT}/catalog-site/dist"
SWA_TOKEN_ENV="SWA_DEPLOYMENT_TOKEN"
ENVIRONMENT="azure-staging"
JSON_OUTPUT=0
VERIFY_GATEWAY=0
GATEWAY_VERIFY_TIMEOUT_SECONDS=180
GATEWAY_VERIFY_POLL_SECONDS=5
RUNTIME_BICEP="${REPO_ROOT}/infra/runtime.bicep"
BOOTSTRAP_BICEP="${REPO_ROOT}/infra/bootstrap.bicep"

# Pinned Static Web Apps CLI version, invoked via `npx --yes` rather than a
# bare `swa` binary. Neither this script's own dependencies nor the
# workflow that calls it install the `swa` CLI globally -- a bare `swa`
# call would fail with "command not found" the first time this actually
# runs in CI. `npx --yes <pkg>@<version>` fetches (and caches) the exact
# pinned version on demand without requiring a pre-installed global binary
# or a package.json dependency in this directory, and --yes suppresses
# npx's interactive "ok to install" prompt so this stays non-interactive
# in CI.
SWA_CLI_PACKAGE="@azure/static-web-apps-cli@2.0.9"

usage() {
  cat <<EOF
Usage: $(basename "$0") --gateway-image <ref> --copilot-image <ref>
                        [--apply] [--sha <sha>] [--site-dist <path>]
                        [--swa-deployment-token-env <VAR_NAME>]
                        [--environment azure-staging|production]
                        [--verify-gateway] [--gateway-verify-timeout <secs>] [--gateway-verify-poll-interval <secs>]
                        [--json] [--help]

Contributor-safe runtime deployment only. Never invokes Owner bootstrap.
Dry run by default; pass --apply to execute.

--verify-gateway triggers the caj-yolo-ops Container Apps Job to check
gateway health *from inside Azure* -- this script never calls the
IP-restricted gateway directly over the public internet.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --gateway-image)
      require_flag_value "--gateway-image" "${2-}"
      GATEWAY_IMAGE="$2"; shift 2 ;;
    --copilot-image)
      require_flag_value "--copilot-image" "${2-}"
      COPILOT_IMAGE="$2"; shift 2 ;;
    --sha)
      require_flag_value "--sha" "${2-}"
      SHA_OVERRIDE="$2"; shift 2 ;;
    --site-dist)
      require_flag_value "--site-dist" "${2-}"
      SITE_DIST="$2"; shift 2 ;;
    --swa-deployment-token-env)
      require_flag_value "--swa-deployment-token-env" "${2-}"
      SWA_TOKEN_ENV="$2"; shift 2 ;;
    --environment)
      require_flag_value "--environment" "${2-}"
      ENVIRONMENT="$2"; shift 2 ;;
    --verify-gateway) VERIFY_GATEWAY=1; shift ;;
    --gateway-verify-timeout)
      require_flag_value "--gateway-verify-timeout" "${2-}"
      GATEWAY_VERIFY_TIMEOUT_SECONDS="$2"; shift 2 ;;
    --gateway-verify-poll-interval)
      require_flag_value "--gateway-verify-poll-interval" "${2-}"
      GATEWAY_VERIFY_POLL_SECONDS="$2"; shift 2 ;;
    --json) JSON_OUTPUT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

if [[ -z "$GATEWAY_IMAGE" ]]; then
  log_error "--gateway-image is required"; usage; exit 2
fi
if [[ -z "$COPILOT_IMAGE" ]]; then
  log_error "--copilot-image is required"; usage; exit 2
fi
case "$ENVIRONMENT" in
  azure-staging|production) ;;
  *) die "--environment must be 'azure-staging' or 'production', got: $ENVIRONMENT" ;;
esac

# This script's one and only job boundary: it must never be the thing that
# reaches for Owner bootstrap, even indirectly. Fail loudly if anyone tries
# to wire that in later.
assert_never_calls_bootstrap() {
  if [[ -n "${YOLO_INTERNAL_CALL_BOOTSTRAP:-}" ]]; then
    die "deploy.sh must never invoke Owner bootstrap (infra/bootstrap.bicep). Refusing."
  fi
}

validate_immutable_ref() {
  local label="$1" ref="$2"
  # Expect "<registry>/<repo>:<sha>" with a 7-40 char hex tag. Reject
  # mutable tags like 'latest' outright.
  local tag="${ref##*:}"
  if [[ "$ref" != *:* ]]; then
    die "$label image ref '$ref' has no tag; immutable Git SHA tags are required"
  fi
  if [[ "$tag" == "latest" || "$tag" == "main" || "$tag" == "dev" ]]; then
    die "$label image ref '$ref' uses a mutable tag ('$tag'); use an immutable Git SHA tag"
  fi
  if ! [[ "$tag" =~ ^[0-9a-f]{7,40}$ ]]; then
    die "$label image ref '$ref' tag '$tag' does not look like a Git SHA"
  fi
  if [[ -n "$SHA_OVERRIDE" && "$tag" != "$SHA_OVERRIDE"* && "$SHA_OVERRIDE" != "$tag"* ]]; then
    die "$label image tag '$tag' does not match expected SHA '$SHA_OVERRIDE'"
  fi
}

check_runtime_bicep_exists() {
  if [[ ! -f "$RUNTIME_BICEP" ]]; then
    if [[ "$APPLY" == "1" ]]; then
      die "$RUNTIME_BICEP missing; the infra/ lane must land before deploy.sh can apply."
    fi
    log_warn "$RUNTIME_BICEP not present yet (informational for dry run; required before --apply)."
  fi
  if [[ -f "$BOOTSTRAP_BICEP" ]]; then
    log_info "Owner-only $BOOTSTRAP_BICEP present but will not be touched by this script."
  fi
}

deploy_gateway() {
  local cmd=(az containerapp update
    --name "$YOLO_GATEWAY_APP"
    --resource-group "$YOLO_RESOURCE_GROUP"
    --image "$GATEWAY_IMAGE")
  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "gateway Container App update -> $GATEWAY_IMAGE"
    log_info "Would run: $(join_spaces "${cmd[@]}")"
    return
  fi
  log_step "Deploying gateway image: $GATEWAY_IMAGE"
  "${cmd[@]}"
}

deploy_copilot_runtime() {
  local cmd=(az containerapp update
    --name "$YOLO_COPILOT_APP"
    --resource-group "$YOLO_RESOURCE_GROUP"
    --image "$COPILOT_IMAGE")
  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "copilot runtime Container App update -> $COPILOT_IMAGE"
    log_info "Would run: $(join_spaces "${cmd[@]}")"
    return
  fi
  log_step "Deploying copilot runtime image: $COPILOT_IMAGE"
  "${cmd[@]}"
}

deploy_static_site() {
  if [[ ! -d "$SITE_DIST" ]]; then
    log_warn "Static site artifact not found at $SITE_DIST; skipping SWA publish (build the Astro site first)."
    return
  fi
  if [[ -z "${!SWA_TOKEN_ENV:-}" ]]; then
    if [[ "$APPLY" == "1" ]]; then
      die "Environment variable \$$SWA_TOKEN_ENV is not set; cannot publish to Static Web Apps."
    fi
    log_warn "Environment variable \$$SWA_TOKEN_ENV is not set (fine for dry run; required for --apply)."
  fi

  # SWA CLI's own --env flag is a *preview environment* selector, entirely
  # separate from this script's own --environment (azure-staging|production
  # GitHub Environment label used for the Container Apps image deploy
  # above). The Static Web Apps *resource* itself does not yet have a
  # separate staging deployment slot or custom-domain-live staging host --
  # both our azure-staging and production labels must publish to the same
  # SWA resource's production/default environment so the generated default
  # hostname (queried by verify.mjs / used for human review) actually
  # serves the build. Passing our own $ENVIRONMENT value here would have
  # tried to deploy "azure-staging" as if it were a named SWA preview
  # environment, which does not exist. This is intentionally hardcoded,
  # not derived from $ENVIRONMENT.
  local swa_cli_env="production"
  local cmd=(npx --yes "$SWA_CLI_PACKAGE" deploy "$SITE_DIST"
    --deployment-token "<redacted:\$$SWA_TOKEN_ENV>"
    --env "$swa_cli_env")
  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "Static Web Apps publish from $SITE_DIST (github-environment=$ENVIRONMENT, swa-cli-env=$swa_cli_env)"
    log_info "Would run: $(join_spaces "${cmd[@]}")"
    return
  fi
  log_step "Publishing static site artifact from $SITE_DIST (github-environment=$ENVIRONMENT, swa-cli-env=$swa_cli_env)"
  npx --yes "$SWA_CLI_PACKAGE" deploy "$SITE_DIST" --deployment-token "${!SWA_TOKEN_ENV}" --env "$swa_cli_env"
}

# Triggers gateway health verification from *inside* Azure via the
# caj-yolo-ops Container Apps Job, then polls its execution to completion.
# This script must never call the gateway's public URL directly -- the
# staging gateway's ingress allows only Wyatt's IP (plan Sec. "Network
# boundaries"), and a GitHub-hosted runner is never on that allow-list.
# `az containerapp job start` runs the job's container inside the same
# Container Apps environment as the gateway, so it can reach it without
# touching (or needing to weaken) that restriction at all.
trigger_gateway_verification() {
  if [[ "$VERIFY_GATEWAY" != "1" ]]; then
    return
  fi

  log_step "Triggering gateway health verification via $YOLO_OPS_JOB (runs inside Azure -- this script never calls the IP-restricted gateway directly)"

  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "starting Container Apps job $YOLO_OPS_JOB for gateway verification"
    log_info "Would run: az containerapp job start --name $YOLO_OPS_JOB --resource-group $YOLO_RESOURCE_GROUP"
    return
  fi

  require_cmd az
  local execution_name
  execution_name="$(az containerapp job start \
    --name "$YOLO_OPS_JOB" \
    --resource-group "$YOLO_RESOURCE_GROUP" \
    --query "name" -o tsv)"
  if [[ -z "$execution_name" ]]; then
    die "Failed to start $YOLO_OPS_JOB; no execution name was returned."
  fi
  log_info "Started $YOLO_OPS_JOB execution: $execution_name"

  local waited=0 status="Running"
  while [[ "$status" == "Running" && "$waited" -lt "$GATEWAY_VERIFY_TIMEOUT_SECONDS" ]]; do
    sleep "$GATEWAY_VERIFY_POLL_SECONDS"
    waited=$((waited + GATEWAY_VERIFY_POLL_SECONDS))
    status="$(az containerapp job execution show \
      --name "$YOLO_OPS_JOB" \
      --resource-group "$YOLO_RESOURCE_GROUP" \
      --job-execution-name "$execution_name" \
      --query "properties.status" -o tsv 2>/dev/null || echo "Unknown")"
  done

  case "$status" in
    Succeeded)
      log_info "Gateway verification succeeded ($YOLO_OPS_JOB execution $execution_name)." ;;
    Running)
      die "Gateway verification timed out after ${GATEWAY_VERIFY_TIMEOUT_SECONDS}s (execution $execution_name still running). Check with: az containerapp job execution show --name $YOLO_OPS_JOB --resource-group $YOLO_RESOURCE_GROUP --job-execution-name $execution_name" ;;
    *)
      die "Gateway verification failed (status=$status, execution $execution_name). Check logs with: az containerapp job logs show --name $YOLO_OPS_JOB --resource-group $YOLO_RESOURCE_GROUP" ;;
  esac
}

main() {
  assert_never_calls_bootstrap
  require_clean_worktree "$REPO_ROOT"
  validate_immutable_ref "gateway" "$GATEWAY_IMAGE"
  validate_immutable_ref "copilot-runtime" "$COPILOT_IMAGE"
  check_runtime_bicep_exists

  if [[ "$APPLY" == "1" ]]; then
    require_cmd az
  fi

  deploy_gateway
  deploy_copilot_runtime
  deploy_static_site
  trigger_gateway_verification

  if [[ "$JSON_OUTPUT" == "1" ]]; then
    printf '{"applied":%s,"environment":"%s","gatewayImage":"%s","copilotImage":"%s","gatewayVerification":%s}\n' \
      "$( [[ $APPLY -eq 1 ]] && echo true || echo false )" \
      "$ENVIRONMENT" "$GATEWAY_IMAGE" "$COPILOT_IMAGE" \
      "$( [[ $VERIFY_GATEWAY -eq 1 ]] && echo true || echo false )"
  fi
}

main "$@"
