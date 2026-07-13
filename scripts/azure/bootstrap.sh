#!/usr/bin/env bash
# scripts/azure/bootstrap.sh
#
# Owner-only, one-time Azure bootstrap wrapper for the CurationsX Yolo Azure
# migration (see .azure/deployment-plan.md, Stage 1).
#
# This script does NOT create resources itself. It performs every
# prerequisite, provider, name-availability, quota, and authority check
# described in the plan, then -- only when explicitly told to apply --
# invokes the Owner-only Bicep entry point (`infra/bootstrap.bicep`) through
# `az deployment sub create`. Routine CI must never call this script; it is
# for a single interactively authenticated Owner run.
#
# Default mode is a safe, read-only dry run. Nothing is created, no secret is
# printed, and a dirty git worktree always aborts the script before any Azure
# call is attempted.
#
# Usage:
#   scripts/azure/bootstrap.sh [--apply] [--confirm bootstrap-yolo-prod]
#                              [--subscription <id>] [--location <region>]
#                              [--budget-contact-email <email[,email...]>]
#                              [--skip-quota-check] [--json]
#
# Exit codes:
#   0  success (dry run report printed, or bootstrap applied)
#   1  a prerequisite, safety, or quota check failed
#   2  invalid arguments
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=lib/config.sh
source "${SCRIPT_DIR}/lib/config.sh"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

APPLY=0
MODE="bootstrap"
CONFIRM_TOKEN=""
SUBSCRIPTION="${AZURE_SUBSCRIPTION_ID}"
LOCATION="${AZURE_LOCATION}"
SKIP_QUOTA_CHECK=0
JSON_OUTPUT=0
BOOTSTRAP_CONFIRM_PHRASE="bootstrap-${YOLO_RESOURCE_GROUP}"
GITHUB_CONFIGURE_CONFIRM_PHRASE="configure-github-environments"
BICEP_ENTRY_POINT="${REPO_ROOT}/infra/bootstrap.bicep"
STAGING_BRANCHES_OVERRIDE=""
# Non-secret (never printed by this script), but never committed to source
# control either: infra/bootstrap.bicep's budgetContactEmails defaults to
# an empty array and SKIPS creating the $YOLO_BUDGET_AMOUNT budget
# entirely when empty (see infra/bootstrap.bicep's budgetContactEmails
# @description) -- required so the plan's "Azure budget active" acceptance
# criterion is actually met. Comma-separated for multiple recipients.
BUDGET_CONTACT_EMAIL="${YOLO_BUDGET_CONTACT_EMAIL:-}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--apply] [--confirm ${BOOTSTRAP_CONFIRM_PHRASE}]
                        [--subscription <id>] [--location <region>]
                        [--budget-contact-email <email[,email...]>]
                        [--skip-quota-check] [--json] [--help]
       $(basename "$0") --configure-github-environments --confirm ${GITHUB_CONFIGURE_CONFIRM_PHRASE}
                        [--staging-branches <comma,list>]

Owner-only, one-time Azure bootstrap for rg-yolo-prod. Dry run by default.

--budget-contact-email (or \$YOLO_BUDGET_CONTACT_EMAIL) is REQUIRED before
--apply: infra/bootstrap.bicep skips creating the \$${YOLO_BUDGET_AMOUNT}
budget entirely when budgetContactEmails is empty, and the committed
parameters intentionally leave it empty. The address is passed inline to
'az deployment sub create' and is never written to a committed params
file or printed by this script -- dry run reports only whether a contact
is configured, never the address itself.

--configure-github-environments applies GitHub's deployment branch policies
(a GitHub API resource, not Azure/Bicep): 'production' restricted to 'main'
only, 'azure-staging' restricted to the current branch (plus 'main', added
automatically). Idempotent -- safe to re-run.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --configure-github-environments) MODE="configure-github-environments"; shift ;;
    --confirm)
      require_flag_value "--confirm" "${2-}"
      CONFIRM_TOKEN="$2"; shift 2 ;;
    --subscription)
      require_flag_value "--subscription" "${2-}"
      SUBSCRIPTION="$2"; shift 2 ;;
    --location)
      require_flag_value "--location" "${2-}"
      LOCATION="$2"; shift 2 ;;
    --staging-branches)
      require_flag_value "--staging-branches" "${2-}"
      STAGING_BRANCHES_OVERRIDE="$2"; shift 2 ;;
    --budget-contact-email)
      require_flag_value "--budget-contact-email" "${2-}"
      BUDGET_CONTACT_EMAIL="$2"; shift 2 ;;
    --skip-quota-check) SKIP_QUOTA_CHECK=1; shift ;;
    --json) JSON_OUTPUT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "Unknown argument: $1"; usage; exit 2 ;;
  esac
done

CHECKS_JSON_ITEMS=()

record_check() {
  # record_check <name> <status: pass|fail|skip> <detail>
  local name="$1" status="$2" detail="$3"
  CHECKS_JSON_ITEMS+=("{\"name\":\"$(printf '%s' "$name" | sed 's/"/\\"/g')\",\"status\":\"$status\",\"detail\":\"$(printf '%s' "$detail" | sed 's/"/\\"/g')\"}")
  case "$status" in
    pass) log_info "PASS  $name -- $detail" ;;
    skip) log_warn "SKIP  $name -- $detail" ;;
    *)    log_error "FAIL  $name -- $detail" ;;
  esac
}

FAILED=0

check_prereqs() {
  log_step "Checking local prerequisites"
  local tool
  for tool in az git jq gh; do
    if command -v "$tool" >/dev/null 2>&1; then
      record_check "prereq:$tool" pass "found on PATH"
    else
      record_check "prereq:$tool" fail "not found on PATH"
      FAILED=1
    fi
  done

  if command -v azd >/dev/null 2>&1; then
    record_check "prereq:azd" pass "Azure Developer CLI found"
  else
    record_check "prereq:azd" fail "Azure Developer CLI (azd) not found; required for Stage 1 bootstrap orchestration"
    FAILED=1
  fi
}

check_worktree() {
  log_step "Checking source-control authority"
  if ! command -v git >/dev/null 2>&1; then
    record_check "worktree:clean" fail "git not available"
    FAILED=1
    return
  fi
  if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    record_check "worktree:clean" fail "$REPO_ROOT is not a git worktree"
    FAILED=1
    return
  fi
  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
    record_check "worktree:clean" fail "uncommitted changes present; source control must be the deployment authority"
    FAILED=1
    return
  fi
  local sha
  sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  record_check "worktree:clean" pass "clean at $sha"
}

check_azure_login() {
  log_step "Checking Azure CLI authentication"
  if ! command -v az >/dev/null 2>&1; then
    record_check "azure:login" fail "az not installed"
    FAILED=1
    return
  fi
  local account_json
  if ! account_json="$(az account show --output json 2>/dev/null)"; then
    record_check "azure:login" fail "not logged in; run 'az login' as the subscription Owner"
    FAILED=1
    return
  fi
  local active_sub
  active_sub="$(printf '%s' "$account_json" | jq -r '.id // empty')"
  if [[ "$active_sub" != "$SUBSCRIPTION" ]]; then
    record_check "azure:subscription" fail "active subscription '$active_sub' does not match expected '$SUBSCRIPTION'"
    FAILED=1
  else
    record_check "azure:subscription" pass "active subscription matches plan"
  fi
}

check_owner_role() {
  log_step "Checking caller has Owner on the target subscription"
  local signed_in_user
  if ! signed_in_user="$(az ad signed-in-user show --query id -o tsv 2>/dev/null)"; then
    record_check "azure:owner-role" fail "could not resolve signed-in principal id"
    FAILED=1
    return
  fi
  local assignments
  assignments="$(az role assignment list \
    --assignee "$signed_in_user" \
    --scope "/subscriptions/${SUBSCRIPTION}" \
    --query "[?roleDefinitionName=='Owner'].roleDefinitionName" \
    --output tsv 2>/dev/null || true)"
  if [[ -n "$assignments" ]]; then
    record_check "azure:owner-role" pass "caller holds Owner at subscription scope"
  else
    record_check "azure:owner-role" fail "caller does not hold Owner at subscription scope; routine CI/Contributor identities must not run this script"
    FAILED=1
  fi
}

check_resource_providers() {
  log_step "Checking required resource provider registrations"
  local providers=(
    Microsoft.App
    Microsoft.ContainerRegistry
    Microsoft.KeyVault
    Microsoft.OperationalInsights
    Microsoft.DocumentDB
    Microsoft.CognitiveServices
    Microsoft.Web
    Microsoft.Quota
    Microsoft.ManagedIdentity
    Microsoft.Consumption
  )
  local provider state
  for provider in "${providers[@]}"; do
    state="$(az provider show --namespace "$provider" --query registrationState -o tsv 2>/dev/null || echo "Unknown")"
    if [[ "$state" == "Registered" ]]; then
      record_check "provider:$provider" pass "Registered"
    else
      record_check "provider:$provider" fail "state=$state (expected Registered)"
      FAILED=1
    fi
  done
}

check_name_availability() {
  log_step "Checking resource name availability"

  local acr_available
  acr_available="$(az acr check-name --name "$YOLO_ACR_NAME" --query nameAvailable -o tsv 2>/dev/null || echo "false")"
  if [[ "$acr_available" == "true" ]]; then
    record_check "name:acr:$YOLO_ACR_NAME" pass "available"
  else
    # Already-existing under our own resource group is fine on re-run; only a
    # genuine collision with someone else's registry is fatal.
    local existing
    existing="$(az acr show --name "$YOLO_ACR_NAME" --resource-group "$YOLO_RESOURCE_GROUP" --query name -o tsv 2>/dev/null || true)"
    if [[ "$existing" == "$YOLO_ACR_NAME" ]]; then
      record_check "name:acr:$YOLO_ACR_NAME" pass "already provisioned in $YOLO_RESOURCE_GROUP (idempotent re-run)"
    else
      record_check "name:acr:$YOLO_ACR_NAME" fail "name unavailable and not owned by $YOLO_RESOURCE_GROUP"
      FAILED=1
    fi
  fi

  local kv_state
  kv_state="$(az keyvault show --name "$YOLO_KEY_VAULT" --query "properties.provisioningState" -o tsv 2>/dev/null || true)"
  if [[ -z "$kv_state" ]]; then
    record_check "name:keyvault:$YOLO_KEY_VAULT" pass "no conflicting vault found (or not yet created)"
  else
    local kv_rg
    kv_rg="$(az keyvault show --name "$YOLO_KEY_VAULT" --query "resourceGroup" -o tsv 2>/dev/null || true)"
    if [[ "$kv_rg" == "$YOLO_RESOURCE_GROUP" ]]; then
      record_check "name:keyvault:$YOLO_KEY_VAULT" pass "already provisioned in $YOLO_RESOURCE_GROUP (idempotent re-run)"
    else
      record_check "name:keyvault:$YOLO_KEY_VAULT" fail "vault exists in unexpected resource group '$kv_rg'"
      FAILED=1
    fi
  fi
}

check_quota() {
  if [[ "$SKIP_QUOTA_CHECK" == "1" ]]; then
    record_check "quota:container-apps-cores" skip "explicitly skipped with --skip-quota-check"
    return
  fi
  log_step "Checking Container Apps consumption core quota"
  local usage_json
  if ! usage_json="$(az containerapp env list-usages \
      --resource-group "$YOLO_RESOURCE_GROUP" \
      --name "$YOLO_CONTAINERAPPS_ENV" \
      --output json 2>/dev/null)"; then
    record_check "quota:container-apps-cores" skip "environment does not exist yet; quota gate re-runs after Stage 1 environment creation"
    return
  fi
  local available
  available="$(printf '%s' "$usage_json" | jq -r '
    ([.[] | select(.name.value == "Consumption Cores" or .name.value == "Cores")][0]) as $c
    | if $c == null then "" else ($c.limit - $c.currentValue) end
  ')"
  if [[ -z "$available" ]]; then
    record_check "quota:container-apps-cores" fail "could not determine available consumption cores from usage payload"
    FAILED=1
    return
  fi
  if awk -v have="$available" -v need="$YOLO_MIN_CONSUMPTION_CORES" 'BEGIN{exit !(have+0 >= need+0)}'; then
    record_check "quota:container-apps-cores" pass "available=$available required=$YOLO_MIN_CONSUMPTION_CORES"
  else
    record_check "quota:container-apps-cores" fail "available=$available is below required=$YOLO_MIN_CONSUMPTION_CORES"
    FAILED=1
  fi
}

check_bicep_entry_point() {
  log_step "Checking Owner-only Bicep entry point exists"
  if [[ -f "$BICEP_ENTRY_POINT" ]]; then
    record_check "infra:bootstrap-bicep" pass "$BICEP_ENTRY_POINT present"
  elif [[ "$APPLY" == "1" ]]; then
    # Only a hard blocker when actually applying; the infra/ Bicep lane may
    # land independently of scripts/azure and dry-run checks should not
    # falsely report the whole bootstrap as unready because of it.
    record_check "infra:bootstrap-bicep" fail "$BICEP_ENTRY_POINT missing; the infra/ lane must land before --apply can run"
    FAILED=1
  else
    record_check "infra:bootstrap-bicep" skip "$BICEP_ENTRY_POINT not present yet (informational for dry run; required before --apply)"
  fi
}

# infra/bootstrap.bicep's budgetContactEmails param defaults to an empty
# array and the committed infra/main.parameters.json intentionally leaves
# it empty (an email address is not something to commit to source
# control) -- so the $YOLO_BUDGET_AMOUNT budget (plan acceptance criterion
# "Azure budget active") is silently skipped unless this script supplies
# one at apply time. Reports presence only; the address itself is never
# logged, even in dry run or --json output.
check_budget_contact_email() {
  log_step "Checking budget contact email configuration"
  if [[ -n "$BUDGET_CONTACT_EMAIL" ]]; then
    record_check "budget:contact-email" pass "configured"
  elif [[ "$APPLY" == "1" ]]; then
    record_check "budget:contact-email" fail "no budget contact email configured; pass --budget-contact-email <email> or set \$YOLO_BUDGET_CONTACT_EMAIL before --apply (required for plan acceptance criterion 'Azure budget active' -- infra/bootstrap.bicep skips the \$${YOLO_BUDGET_AMOUNT} budget entirely when budgetContactEmails is empty)"
    FAILED=1
  else
    record_check "budget:contact-email" skip "not configured yet (informational for dry run; required before --apply so the \$${YOLO_BUDGET_AMOUNT} budget is actually created)"
  fi
}

current_git_branch() {
  git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

# check_environment_branch_policy <env-name> <required-branch>
#
# An environment-scoped OIDC federated subject
# (repo:<repo>:environment:<name>) only narrows *which token* a job can
# mint -- it does NOT by itself restrict *which git ref* may use that
# environment. That restriction is a separate GitHub API resource: the
# environment's own deployment branch policy. This check fails closed if:
#   - the environment does not exist, or 'gh api' cannot reach it;
#   - custom branch policies are not enabled (meaning any branch, or any
#     branch with GitHub branch protection, could deploy -- not the narrow
#     allow-list this plan requires);
#   - the required branch is not present in that allow-list;
#   - any wildcard-shaped pattern is present (equivalent to "arbitrary
#     branch");
#   - for 'production' specifically, any branch other than 'main' is
#     present at all.
check_environment_branch_policy() {
  local env="$1" required_branch="$2"
  local policy_json
  policy_json="$(gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}" 2>/dev/null || true)"
  if [[ -z "$policy_json" ]]; then
    record_check "github:env:${env}" fail "environment '$env' not found (or 'gh api' call failed)"
    FAILED=1
    return
  fi

  local custom_enabled
  custom_enabled="$(printf '%s' "$policy_json" | jq -r '.deployment_branch_policy.custom_branch_policies // false')"
  if [[ "$custom_enabled" != "true" ]]; then
    record_check "github:env:${env}:custom-policy" fail "environment '$env' does not have a custom deployment branch policy enabled; it is callable from an arbitrary (or any protected) branch"
    FAILED=1
    return
  fi
  record_check "github:env:${env}:custom-policy" pass "custom branch policy enabled"

  local branches_json names
  branches_json="$(gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}/deployment-branch-policies" 2>/dev/null || echo '{"branch_policies":[]}')"
  names="$(printf '%s' "$branches_json" | jq -r '.branch_policies[].name' 2>/dev/null || true)"

  if [[ -z "$names" ]]; then
    record_check "github:env:${env}:branches" fail "environment '$env' has no branch policies configured; it is callable from an arbitrary branch"
    FAILED=1
    return
  fi

  local has_required=0 has_wildcard=0
  local extras=()
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if [[ "$name" == "$required_branch" ]]; then has_required=1; fi
    if [[ "$name" == *'*'* ]]; then has_wildcard=1; fi
    if [[ "$name" != "$required_branch" && "$name" != "main" ]]; then extras+=("$name"); fi
  done <<< "$names"

  if [[ "$has_wildcard" == "1" ]]; then
    record_check "github:env:${env}:branches" fail "environment '$env' includes a wildcard branch pattern; this leaves it callable from an arbitrary branch"
    FAILED=1
    return
  fi
  if [[ "$has_required" != "1" ]]; then
    record_check "github:env:${env}:branches" fail "environment '$env' does not include the required branch pattern '$required_branch'"
    FAILED=1
    return
  fi
  if [[ "$env" == "production" && ${#extras[@]} -gt 0 ]]; then
    record_check "github:env:${env}:branches" fail "environment 'production' allows branch(es) other than 'main': ${extras[*]}"
    FAILED=1
    return
  fi

  record_check "github:env:${env}:branches" pass "restricted to: $(printf '%s' "$names" | tr '\n' ',' | sed 's/,$//')"
}

check_github_environment_branch_policies() {
  log_step "Checking GitHub environment deployment branch policies"
  if ! gh auth status >/dev/null 2>&1; then
    record_check "github:auth" fail "gh CLI is not authenticated (run 'gh auth login')"
    FAILED=1
    return
  fi
  record_check "github:auth" pass "gh CLI authenticated"

  check_environment_branch_policy "production" "main"
  check_environment_branch_policy "azure-staging" "$(current_git_branch)"
}

emit_summary() {
  if [[ "$JSON_OUTPUT" == "1" ]]; then
    printf '{"failed":%s,"checks":[%s]}\n' \
      "$( [[ $FAILED -eq 1 ]] && echo true || echo false )" \
      "$(IFS=,; echo "${CHECKS_JSON_ITEMS[*]}")"
  fi
}

run_checks() {
  check_prereqs
  check_worktree
  check_azure_login
  check_owner_role
  check_resource_providers
  check_name_availability
  check_quota
  check_bicep_entry_point
  check_budget_contact_email
  check_github_environment_branch_policies
}

# Converts a comma-separated email list into a compact JSON array string
# (e.g. "a@b.com,c@d.com" -> ["a@b.com","c@d.com"]) via jq, so each address
# is safely JSON-encoded rather than hand-quoted in bash. Never logged by
# any caller -- only passed directly as an `az` parameter value.
budget_contact_emails_json() {
  local csv="$1"
  local -a emails
  IFS=',' read -r -a emails <<< "$csv"
  printf '%s\n' "${emails[@]}" | jq -R . | jq -s -c .
}

apply_bootstrap() {
  log_step "Applying Owner-only bootstrap deployment"
  require_exact_confirmation "$CONFIRM_TOKEN" "$BOOTSTRAP_CONFIRM_PHRASE"

  if [[ ! -f "${REPO_ROOT}/infra/main.parameters.json" ]]; then
    die "Missing ${REPO_ROOT}/infra/main.parameters.json; cannot apply without parameters committed to source control."
  fi
  if [[ -z "$BUDGET_CONTACT_EMAIL" ]]; then
    # Defense in depth: check_budget_contact_email (run_checks) already
    # fails closed before main() ever reaches here, but this function must
    # never assume that ordering on its own.
    die "No budget contact email configured; pass --budget-contact-email <email> or set \$YOLO_BUDGET_CONTACT_EMAIL before --apply."
  fi

  local budget_emails_json
  budget_emails_json="$(budget_contact_emails_json "$BUDGET_CONTACT_EMAIL")"

  log_info "Invoking: az deployment sub create --location $LOCATION --template-file $BICEP_ENTRY_POINT --parameters @${REPO_ROOT}/infra/main.parameters.json --parameters budgetContactEmails=<redacted: configured>"
  az deployment sub create \
    --location "$LOCATION" \
    --template-file "$BICEP_ENTRY_POINT" \
    --parameters "@${REPO_ROOT}/infra/main.parameters.json" \
    --parameters resourceGroupName="$YOLO_RESOURCE_GROUP" \
    --parameters budgetContactEmails="$budget_emails_json"

  log_info "Bootstrap deployment submitted. Secrets are never echoed by this script; retrieve them from Key Vault via 'az keyvault secret show' when needed."
}

# configure_environment_branch_policy <env> <branch> <mode: main-only|allow-extra>
# Idempotent: enables custom branch policies (no-op if already enabled),
# adds the branch pattern if missing (no-op if already present), and for
# mode=main-only removes any other branch pattern present -- production
# must never allow a branch other than main, matching
# check_environment_branch_policy's read-side enforcement above.
configure_environment_branch_policy() {
  local env="$1" branch="$2" mode="$3"
  log_step "Configuring '$env' deployment branch policy for '$branch'"

  printf '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
    | gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}" -X PUT --input - >/dev/null

  local branches_json existing_names
  branches_json="$(gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}/deployment-branch-policies")"
  existing_names="$(printf '%s' "$branches_json" | jq -r '.branch_policies[].name' 2>/dev/null || true)"

  if printf '%s\n' "$existing_names" | grep -qxF "$branch"; then
    log_info "Branch policy '$branch' already present on '$env' (idempotent, no change)"
  else
    log_info "Adding branch policy '$branch' to '$env'"
    gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}/deployment-branch-policies" -X POST -f "name=$branch" >/dev/null
  fi

  if [[ "$mode" == "main-only" ]]; then
    branches_json="$(gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}/deployment-branch-policies")"
    local rows
    rows="$(printf '%s' "$branches_json" | jq -c '.branch_policies[]')"
    while IFS= read -r row; do
      [[ -z "$row" ]] && continue
      local id name
      id="$(printf '%s' "$row" | jq -r '.id')"
      name="$(printf '%s' "$row" | jq -r '.name')"
      if [[ "$name" != "main" ]]; then
        log_warn "Removing branch policy '$name' from '$env' (only 'main' may deploy to production)"
        gh api "repos/${YOLO_GITHUB_REPOSITORY}/environments/${env}/deployment-branch-policies/${id}" -X DELETE >/dev/null
      fi
    done <<< "$rows"
  fi
}

# Configures both environments' deployment branch policies (a GitHub API
# resource; not expressible in Bicep, hence not part of apply_bootstrap
# above): 'production' restricted to 'main' only, 'azure-staging'
# restricted to the current feature branch plus 'main' (added automatically
# so the same policy already covers the eventual merge). Idempotent --
# safe to re-run at any point, e.g. as new feature branches rotate through
# staging.
configure_github_environments() {
  log_step "Configuring GitHub environment deployment branch policies"
  require_cmd gh
  require_cmd jq
  if ! gh auth status >/dev/null 2>&1; then
    die "gh CLI is not authenticated (run 'gh auth login')."
  fi
  require_exact_confirmation "$CONFIRM_TOKEN" "$GITHUB_CONFIGURE_CONFIRM_PHRASE"

  local staging_branch_list="$STAGING_BRANCHES_OVERRIDE"
  if [[ -z "$staging_branch_list" ]]; then
    staging_branch_list="$(current_git_branch)"
  fi
  if [[ -z "$staging_branch_list" || "$staging_branch_list" == "HEAD" ]]; then
    die "Could not determine the current branch (detached HEAD?). Pass --staging-branches explicitly."
  fi

  configure_environment_branch_policy "production" "main" "main-only"

  local branch
  IFS=',' read -r -a staging_branches <<< "$staging_branch_list"
  for branch in "${staging_branches[@]}"; do
    [[ -z "$branch" ]] && continue
    configure_environment_branch_policy "azure-staging" "$branch" "allow-extra"
  done
  # Always also allow main on staging, so the same policy already covers
  # the eventual merge without a follow-up configuration run.
  configure_environment_branch_policy "azure-staging" "main" "allow-extra"

  log_info "GitHub environment branch policies configured."
  log_info "Verify with: gh api repos/${YOLO_GITHUB_REPOSITORY}/environments/<name>/deployment-branch-policies"
}

main() {
  if [[ "$MODE" == "configure-github-environments" ]]; then
    configure_github_environments
    exit 0
  fi

  run_checks
  emit_summary

  if [[ "$FAILED" == "1" ]]; then
    die "One or more prerequisite checks failed. Resolve them before re-running."
  fi

  if [[ "$APPLY" != "1" ]]; then
    print_dry_run_banner "Owner bootstrap of $YOLO_RESOURCE_GROUP in $LOCATION"
    log_info "All checks passed. Re-run with --apply --confirm ${BOOTSTRAP_CONFIRM_PHRASE} to execute (Owner session only)."
    exit 0
  fi

  apply_bootstrap
}

main "$@"
