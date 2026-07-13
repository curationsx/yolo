#!/usr/bin/env bash
# scripts/azure/test/run-bash-tests.sh
#
# Lightweight test harness (no external test framework required) covering
# argument parsing, dry-run behavior, and confirmation/refusal gates for the
# scripts/azure/*.sh entry points. Uses a fixture `az`/`gh` on PATH and a
# throwaway git repository so it never touches real Azure, GitHub, or the
# real repository's working-tree state.
#
# The scratch directory is unique per invocation (PID-suffixed), not a fixed
# path -- this repository is worked on by multiple concurrent agent lanes
# sharing the same checkout, and two simultaneous test runs against a fixed
# path would race on the same throwaway git repo / fixture state files,
# producing sporadic, non-reproducible failures. A unique-per-run directory
# makes concurrent invocations of this suite safe.
set -uo pipefail

TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
AZURE_DIR="$(cd -- "${TEST_DIR}/.." >/dev/null 2>&1 && pwd -P)"
SCRATCH="${AZURE_DIR}/test/.tmp-run-$$"

PASS=0
FAIL=0
FAILURES=()

rm -rf -- "$SCRATCH"
mkdir -p "$SCRATCH"

# --- assertion helpers ---------------------------------------------------

ok() { PASS=$((PASS+1)); printf '  ok   - %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); FAILURES+=("$1"); printf '  FAIL - %s\n' "$1"; }

assert_exit_code() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then ok "$desc (exit=$actual)"; else bad "$desc (expected exit=$expected, got=$actual)"; fi
}

assert_equal() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then ok "$desc"; else bad "$desc (expected '$expected', got '$actual')"; fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then ok "$desc"; else bad "$desc (expected to contain: $needle)"; fi
}

assert_not_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then ok "$desc"; else bad "$desc (expected NOT to contain: $needle)"; fi
}

assert_file_mode() {
  local desc="$1" file="$2" expected_mode="$3"
  local actual_mode
  actual_mode="$(stat -f '%Lp' "$file" 2>/dev/null || stat -c '%a' "$file" 2>/dev/null)"
  if [[ "$actual_mode" == "$expected_mode" ]]; then ok "$desc (mode=$actual_mode)"; else bad "$desc (expected mode=$expected_mode, got=$actual_mode)"; fi
}

# --- fixture git repo -----------------------------------------------------

make_fixture_repo() {
  local dir="$1"
  rm -rf -- "$dir"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" config user.email "fixture@example.com"
  git -C "$dir" config user.name "Fixture"
  echo "fixture" > "$dir/README.md"
  mkdir -p "$dir/agent-worker/copilot-runtime" "$dir/catalog-site/dist" "$dir/infra"
  echo "FROM scratch" > "$dir/agent-worker/Dockerfile.azure"
  echo "FROM scratch" > "$dir/agent-worker/copilot-runtime/Dockerfile"
  echo "<html></html>" > "$dir/catalog-site/dist/index.html"
  echo "// fixture stub, not real Bicep" > "$dir/infra/runtime.bicep"
  echo "// fixture stub, not real Bicep" > "$dir/infra/bootstrap.bicep"
  # Intentionally does NOT include budgetContactEmails -- mirrors the real
  # committed infra/main.parameters.json, which leaves it empty on
  # purpose. bootstrap.sh must supply it inline via --budget-contact-email
  # instead, never by committing it here.
  cat > "$dir/infra/main.parameters.json" <<'EOF'
{"$schema":"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#","contentVersion":"1.0.0.0","parameters":{}}
EOF
  git -C "$dir" add -A
  git -C "$dir" commit -q -m "fixture: initial commit"
}

dirty_fixture_repo() {
  local dir="$1"
  echo "uncommitted change" >> "$dir/README.md"
}

# --- environment for scripts under test -----------------------------------

FIXTURE_REPO="${SCRATCH}/repo"
make_fixture_repo "$FIXTURE_REPO"

export PATH="${TEST_DIR}/fixtures/bin:${PATH}"
export YOLO_REPO_ROOT_OVERRIDE="$FIXTURE_REPO"
export YOLO_PRIVATE_WORKDIR_BASE="$SCRATCH"

run_script() {
  # run_script <ledger_file> <script> [args...]
  local ledger="$1"; shift
  local script="$1"; shift
  AZ_LEDGER="$ledger" "$script" "$@"
}

echo "== bootstrap.sh =="

# A dedicated, realistic branch name (matching the actual project's current
# feature branch pattern) so the GitHub environment branch-policy checks
# below have a deterministic, known value to assert against regardless of
# the local git installation's default branch name.
git -C "$FIXTURE_REPO" checkout -q -b feat/catalog-site
GH_STATE_DIR="${SCRATCH}/gh-state"
mkdir -p "$GH_STATE_DIR"

make_compliant_gh_state() {
  # make_compliant_gh_state <state_file> -- both environments already
  # correctly configured: production -> main only; azure-staging ->
  # feat/catalog-site + main.
  cat > "$1" <<'EOF'
{"environments":{"production":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"}]},"azure-staging":{"customBranchPolicies":true,"branches":[{"id":1,"name":"feat/catalog-site"},{"id":2,"name":"main"}]}}}
EOF
}

make_unconfigured_gh_state() {
  cat > "$1" <<'EOF'
{"environments":{"production":{"customBranchPolicies":false,"branches":[]},"azure-staging":{"customBranchPolicies":false,"branches":[]}}}
EOF
}

echo "-- dry run passes all checks and performs no mutation --"
ledger="${SCRATCH}/bootstrap-dryrun.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/dryrun.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --json 2>&1)"
code=$?
assert_exit_code "bootstrap dry run exits 0 when checks pass" 0 "$code"
assert_contains "bootstrap dry run mentions --apply" "$out" "--apply"
assert_not_contains "bootstrap dry run never calls 'deployment sub create'" "$(cat "$ledger")" "deployment sub"

echo "-- fails closed when caller is not Owner --"
ledger="${SCRATCH}/bootstrap-notowner.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=0 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses non-Owner caller" 1 "$code"
assert_contains "bootstrap explains Owner requirement" "$out" "Owner"

echo "-- refuses on dirty worktree --"
dirty_fixture_repo "$FIXTURE_REPO"
ledger="${SCRATCH}/bootstrap-dirty.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses dirty worktree" 1 "$code"
assert_contains "bootstrap explains dirty worktree" "$out" "uncommitted changes"
git -C "$FIXTURE_REPO" checkout -- README.md

echo "-- --apply without --confirm refuses --"
ledger="${SCRATCH}/bootstrap-noconfirm.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --apply 2>&1)"
code=$?
assert_exit_code "bootstrap --apply without --confirm refuses" 1 "$code"
assert_not_contains "bootstrap --apply without --confirm performs no mutation" "$(cat "$ledger")" "deployment sub"

echo "-- --apply with wrong --confirm refuses --"
ledger="${SCRATCH}/bootstrap-badconfirm.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --apply --confirm nope 2>&1)"
code=$?
assert_exit_code "bootstrap --apply with wrong --confirm refuses" 1 "$code"
assert_not_contains "bootstrap wrong --confirm performs no mutation" "$(cat "$ledger")" "deployment sub"

echo "-- fails closed on missing resource providers --"
ledger="${SCRATCH}/bootstrap-providers.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=0 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses when providers unregistered" 1 "$code"

echo "-- budget contact email: dry run reports presence only, never the address, and never fails a dry run --"
ledger="${SCRATCH}/bootstrap-budget-dryrun-missing.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/budget-dryrun-missing.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" YOLO_BUDGET_CONTACT_EMAIL="" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --json 2>&1)"
code=$?
assert_exit_code "bootstrap dry run without a budget contact email still exits 0" 0 "$code"
assert_contains "bootstrap dry run reports the budget contact email check by name" "$out" "budget:contact-email"
assert_not_contains "bootstrap dry run never calls 'deployment sub create'" "$(cat "$ledger")" "deployment sub"

ledger="${SCRATCH}/bootstrap-budget-dryrun-configured.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/budget-dryrun-configured.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --budget-contact-email "ops-budget-alerts@example.test" --json 2>&1)"
code=$?
assert_exit_code "bootstrap dry run with a budget contact email exits 0" 0 "$code"
assert_contains "bootstrap dry run reports budget:contact-email as pass" "$out" '"name":"budget:contact-email","status":"pass"'
assert_not_contains "bootstrap dry run never echoes the configured budget contact email address" "$out" "ops-budget-alerts@example.test"

echo "-- budget contact email: required for --apply, refuses before any Azure mutation when missing --"
ledger="${SCRATCH}/bootstrap-budget-apply-missing.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/budget-apply-missing.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" YOLO_BUDGET_CONTACT_EMAIL="" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --apply --confirm "bootstrap-rg-yolo-prod" 2>&1)"
code=$?
assert_exit_code "bootstrap --apply without a budget contact email refuses" 1 "$code"
assert_contains "bootstrap explains the budget contact email is required" "$out" "budget contact email"
assert_not_contains "bootstrap --apply without a budget contact email performs no mutation" "$(cat "$ledger")" "deployment sub"

echo "-- budget contact email: --apply with the flag succeeds, passes budgetContactEmails inline, never echoes the address --"
ledger="${SCRATCH}/bootstrap-budget-apply-ok.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/budget-apply-ok.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" \
  --budget-contact-email "ops-budget-alerts@example.test" \
  --apply --confirm "bootstrap-rg-yolo-prod" --json 2>&1)"
code=$?
assert_exit_code "bootstrap --apply with a budget contact email succeeds" 0 "$code"
assert_contains "bootstrap --apply invokes 'deployment sub create'" "$(cat "$ledger")" "deployment sub"
assert_contains "bootstrap --apply passes budgetContactEmails inline to az" "$(cat "$ledger")" "budgetContactEmails="
assert_not_contains "bootstrap --apply never echoes the budget contact email to its own stdout/stderr" "$out" "ops-budget-alerts@example.test"

echo "-- budget contact email: \$YOLO_BUDGET_CONTACT_EMAIL env var alone satisfies the requirement (no flag needed) --"
ledger="${SCRATCH}/bootstrap-budget-envvar.ledger"
: > "$ledger"
gh_state="${GH_STATE_DIR}/budget-envvar.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" YOLO_BUDGET_CONTACT_EMAIL="ops-via-env@example.test" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" --apply --confirm "bootstrap-rg-yolo-prod" --json 2>&1)"
code=$?
assert_exit_code "bootstrap --apply succeeds via \$YOLO_BUDGET_CONTACT_EMAIL alone" 0 "$code"
assert_contains "bootstrap --apply (env var) invokes 'deployment sub create'" "$(cat "$ledger")" "deployment sub"
assert_not_contains "bootstrap --apply (env var) never echoes the budget contact email" "$out" "ops-via-env@example.test"

echo "-- never prints secret-shaped values --"
ledger="${SCRATCH}/bootstrap-secretcheck.ledger"
: > "$ledger"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  AZ_ACCOUNT_ID="client_secret=super-secret-value" \
  run_script "$ledger" "${AZURE_DIR}/bootstrap.sh" 2>&1)"
assert_not_contains "bootstrap redacts secret-shaped account id" "$out" "super-secret-value"

echo "-- github: fails closed when gh is not authenticated --"
gh_state="${GH_STATE_DIR}/notauth.json"
make_compliant_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=0 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses when gh is not authenticated" 1 "$code"
assert_contains "bootstrap explains gh auth requirement" "$out" "not authenticated"

echo "-- github: fails closed when an environment has no custom branch policy at all --"
gh_state="${GH_STATE_DIR}/unconfigured.json"
make_unconfigured_gh_state "$gh_state"
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses when environments have no custom branch policy" 1 "$code"
assert_contains "bootstrap flags production as unrestricted" "$out" "github:env:production:custom-policy"
assert_contains "bootstrap flags azure-staging as unrestricted" "$out" "github:env:azure-staging:custom-policy"

echo "-- github: fails closed when production allows a wildcard branch pattern --"
gh_state="${GH_STATE_DIR}/wildcard.json"
cat > "$gh_state" <<'EOF'
{"environments":{"production":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"},{"id":2,"name":"*"}]},"azure-staging":{"customBranchPolicies":true,"branches":[{"id":1,"name":"feat/catalog-site"}]}}}
EOF
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses a wildcard branch pattern on production" 1 "$code"
assert_contains "bootstrap explains the wildcard is an arbitrary-branch exposure" "$out" "wildcard branch pattern"

echo "-- github: fails closed when production allows a branch other than main --"
gh_state="${GH_STATE_DIR}/extra-branch.json"
cat > "$gh_state" <<'EOF'
{"environments":{"production":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"},{"id":2,"name":"develop"}]},"azure-staging":{"customBranchPolicies":true,"branches":[{"id":1,"name":"feat/catalog-site"}]}}}
EOF
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses production allowing a non-main branch" 1 "$code"
assert_contains "bootstrap names the offending branch" "$out" "develop"

echo "-- github: fails closed when azure-staging is missing the current feature branch --"
gh_state="${GH_STATE_DIR}/missing-current-branch.json"
cat > "$gh_state" <<'EOF'
{"environments":{"production":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"}]},"azure-staging":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"}]}}}
EOF
out="$(AZ_LOGIN=1 AZ_OWNER_ROLE=1 AZ_PROVIDERS_REGISTERED=1 AZ_ACR_AVAILABLE=1 AZ_KV_EXISTS=0 AZ_ENV_EXISTS=0 \
  GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" 2>&1)"
code=$?
assert_exit_code "bootstrap refuses when azure-staging lacks the current branch" 1 "$code"
assert_contains "bootstrap names the missing required branch" "$out" "feat/catalog-site"

echo "-- --configure-github-environments refuses without --confirm --"
gh_state="${GH_STATE_DIR}/configure-noconfirm.json"
make_unconfigured_gh_state "$gh_state"
out="$(GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" --configure-github-environments 2>&1)"
code=$?
assert_exit_code "configure-github-environments refuses without --confirm" 1 "$code"
assert_equal "configure-github-environments performs no mutation without --confirm" "false" "$(jq '.environments.production.customBranchPolicies' "$gh_state")"

echo "-- --configure-github-environments configures both environments correctly and idempotently --"
gh_state="${GH_STATE_DIR}/configure-apply.json"
make_unconfigured_gh_state "$gh_state"
out="$(GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" --configure-github-environments --confirm configure-github-environments 2>&1)"
code=$?
assert_exit_code "configure-github-environments exits 0" 0 "$code"
prod_branches="$(jq -r '.environments.production.branches[].name' "$gh_state" | tr '\n' ',' | sed 's/,$//')"
staging_branches="$(jq -r '.environments["azure-staging"].branches[].name' "$gh_state" | sort | tr '\n' ',' | sed 's/,$//')"
assert_equal "configured production is restricted to exactly main" "main" "$prod_branches"
assert_equal "configured azure-staging includes the current branch and main" "feat/catalog-site,main" "$staging_branches"

# Re-run: must be idempotent (no duplicate branch entries, same end state).
out="$(GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" --configure-github-environments --confirm configure-github-environments 2>&1)"
assert_contains "configure-github-environments is idempotent on re-run" "$out" "already present"
staging_count_after_rerun="$(jq '.environments["azure-staging"].branches | length' "$gh_state")"
assert_equal "re-running configure does not duplicate branch entries" "2" "$staging_count_after_rerun"

echo "-- --configure-github-environments prunes a non-main branch from production (self-healing) --"
gh_state="${GH_STATE_DIR}/configure-prune.json"
cat > "$gh_state" <<'EOF'
{"environments":{"production":{"customBranchPolicies":true,"branches":[{"id":1,"name":"main"},{"id":2,"name":"develop"}]},"azure-staging":{"customBranchPolicies":true,"branches":[{"id":1,"name":"feat/catalog-site"}]}}}
EOF
out="$(GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" --configure-github-environments --confirm configure-github-environments 2>&1)"
assert_contains "configure-github-environments warns about removing the extra branch" "$out" "Removing branch policy 'develop'"
prod_branches_after_prune="$(jq -r '.environments.production.branches[].name' "$gh_state" | tr '\n' ',' | sed 's/,$//')"
assert_equal "production is pruned back to exactly main" "main" "$prod_branches_after_prune"

echo "-- --configure-github-environments honors an explicit --staging-branches override --"
gh_state="${GH_STATE_DIR}/configure-override.json"
make_unconfigured_gh_state "$gh_state"
out="$(GH_AUTHENTICATED=1 GH_FIXTURE_STATE_FILE="$gh_state" \
  "${AZURE_DIR}/bootstrap.sh" --configure-github-environments --confirm configure-github-environments --staging-branches "feat/other-branch" 2>&1)"
staging_override_branches="$(jq -r '.environments["azure-staging"].branches[].name' "$gh_state" | sort | tr '\n' ',' | sed 's/,$//')"
assert_equal "configured azure-staging uses the overridden branch plus main" "feat/other-branch,main" "$staging_override_branches"

echo
echo "== build-images.sh =="

echo "-- dry run prints commands but never builds --"
ledger="${SCRATCH}/build-dryrun.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/build-images.sh" --json 2>&1)"
code=$?
assert_exit_code "build-images dry run exits 0" 0 "$code"
assert_not_contains "build-images dry run never calls acr build" "$(cat "$ledger")" "acr build"
assert_contains "build-images dry run output has image refs" "$out" "yolocurationsprod.azurecr.io"

echo "-- refuses on dirty worktree --"
dirty_fixture_repo "$FIXTURE_REPO"
ledger="${SCRATCH}/build-dirty.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/build-images.sh" 2>&1)"
code=$?
assert_exit_code "build-images refuses dirty worktree" 1 "$code"
assert_contains "build-images explains the uncommitted-changes refusal" "$out" "uncommitted changes"

echo "-- refuses on dirty worktree even with an explicit --sha override (regression guard: resolve_sha's override path used to bypass the worktree check entirely) --"
ledger="${SCRATCH}/build-dirty-sha-override.ledger"
: > "$ledger"
valid_sha="$(git -C "$FIXTURE_REPO" rev-parse HEAD)"
out="$(run_script "$ledger" "${AZURE_DIR}/build-images.sh" --sha "$valid_sha" 2>&1)"
code=$?
assert_exit_code "build-images refuses dirty worktree even with --sha given" 1 "$code"
assert_contains "build-images explains the uncommitted-changes refusal even with --sha given" "$out" "uncommitted changes"
assert_not_contains "build-images with --sha on a dirty tree never calls acr build" "$(cat "$ledger")" "acr build"
git -C "$FIXTURE_REPO" checkout -- README.md

echo "-- rejects invalid --sha --"
ledger="${SCRATCH}/build-badsha.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/build-images.sh" --sha "not-a-sha!" 2>&1)"
code=$?
assert_exit_code "build-images rejects malformed --sha" 1 "$code"

echo "-- usage/help never advertises the removed, unimplemented --registry-login-server flag --"
out="$("${AZURE_DIR}/build-images.sh" --help 2>&1)"
assert_not_contains "build-images --help does not mention --registry-login-server" "$out" "registry-login-server"

echo "-- --gateway-only and --copilot-only are mutually exclusive --"
ledger="${SCRATCH}/build-mutex.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/build-images.sh" --gateway-only --copilot-only 2>&1)"
code=$?
assert_exit_code "build-images refuses conflicting scope flags" 1 "$code"

echo
echo "== deploy.sh =="

GATEWAY_SHA="$(git -C "$FIXTURE_REPO" rev-parse HEAD)"

echo "-- dry run never mutates and requires both image refs --"
ledger="${SCRATCH}/deploy-missingargs.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" 2>&1)"
code=$?
assert_exit_code "deploy.sh requires --gateway-image/--copilot-image" 2 "$code"

ledger="${SCRATCH}/deploy-dryrun.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --json 2>&1)"
code=$?
assert_exit_code "deploy.sh dry run exits 0" 0 "$code"
assert_not_contains "deploy.sh dry run never calls containerapp update" "$(cat "$ledger")" "containerapp update"

echo "-- rejects mutable 'latest' tag --"
ledger="${SCRATCH}/deploy-latest.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:latest" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" 2>&1)"
code=$?
assert_exit_code "deploy.sh rejects mutable tag" 1 "$code"

echo "-- rejects invalid --environment --"
ledger="${SCRATCH}/deploy-badenv.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --environment bogus 2>&1)"
code=$?
assert_exit_code "deploy.sh rejects unknown --environment" 1 "$code"

echo "-- never invokes owner bootstrap even if env var attempts it --"
ledger="${SCRATCH}/deploy-bootstrapguard.ledger"
: > "$ledger"
out="$(YOLO_INTERNAL_CALL_BOOTSTRAP=1 run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" 2>&1)"
code=$?
assert_exit_code "deploy.sh refuses if bootstrap invocation is attempted" 1 "$code"

echo "-- --deployment-revision: dry run allowed without it, --apply refuses without it (forces a fresh revision so same-image rollouts can't reuse a cached one) --"
ledger="${SCRATCH}/deploy-revision-dryrun-missing.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" 2>&1)"
code=$?
assert_exit_code "deploy.sh dry run without --deployment-revision still exits 0" 0 "$code"
assert_not_contains "deploy.sh dry run without --deployment-revision never shows --revision-suffix" "$out" "revision-suffix"

ledger="${SCRATCH}/deploy-revision-apply-missing.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --apply 2>&1)"
code=$?
assert_exit_code "deploy.sh --apply without --deployment-revision refuses" 1 "$code"
assert_contains "deploy.sh explains --deployment-revision is required for --apply" "$out" "deployment-revision"
assert_not_contains "deploy.sh --apply without --deployment-revision performs no mutation" "$(cat "$ledger")" "containerapp update"

echo "-- --deployment-revision: dry run with it previews a sanitized, valid --revision-suffix for BOTH apps, deterministically (same input -> same suffix) --"
ledger="${SCRATCH}/deploy-revision-dryrun-given.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --deployment-revision "run-98765" 2>&1)"
code=$?
assert_exit_code "deploy.sh dry run with --deployment-revision exits 0" 0 "$code"
assert_contains "deploy.sh dry run previews --revision-suffix" "$out" "--revision-suffix"
gateway_suffix="$(printf '%s' "$out" | grep -o -- '--revision-suffix r[0-9a-f]\{16\}' | head -1 | awk '{print $2}')"
copilot_suffix="$(printf '%s' "$out" | grep -o -- '--revision-suffix r[0-9a-f]\{16\}' | tail -1 | awk '{print $2}')"
assert_equal "deploy.sh derives a non-empty gateway revision suffix" "1" "$( [[ -n "$gateway_suffix" ]] && echo 1 || echo 0 )"
assert_equal "deploy.sh derives the identical revision suffix for gateway and copilot from the same --deployment-revision input" "$gateway_suffix" "$copilot_suffix"

echo "-- --deployment-revision: --apply passes --revision-suffix to both 'az containerapp update' invocations --"
ledger="${SCRATCH}/deploy-revision-apply-given.ledger"
: > "$ledger"
out="$(SWA_DEPLOYMENT_TOKEN=fixture-swa-token run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --site-dist "${SCRATCH}/no-such-site-dist" \
  --deployment-revision "run-98765" --apply --json 2>&1)"
code=$?
assert_exit_code "deploy.sh --apply with --deployment-revision succeeds" 0 "$code"
suffix_count="$(grep -c -- '--revision-suffix' "$ledger")"
assert_equal "deploy.sh --apply passes --revision-suffix to both containerapp update calls" "2" "$suffix_count"

echo "-- --verify-gateway dry run never calls the gateway directly, only previews the ops job trigger --"
ledger="${SCRATCH}/deploy-verifygateway-dryrun.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --verify-gateway --json 2>&1)"
code=$?
assert_exit_code "deploy.sh --verify-gateway dry run exits 0" 0 "$code"
assert_contains "deploy.sh --verify-gateway dry run mentions caj-yolo-ops" "$out" "caj-yolo-ops"
assert_not_contains "deploy.sh --verify-gateway dry run never starts the job" "$(cat "$ledger")" "job start"
assert_not_contains "deploy.sh never fetches the gateway URL directly (no curl/http client invocation logged)" "$(cat "$ledger")" "curl"

echo "-- --verify-gateway --apply triggers caj-yolo-ops and reports success without a direct gateway call --"
ledger="${SCRATCH}/deploy-verifygateway-apply.ledger"
: > "$ledger"
out="$(AZ_JOB_EXECUTION_STATUS=Succeeded SWA_DEPLOYMENT_TOKEN=fixture-swa-token run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --site-dist "${SCRATCH}/no-such-site-dist" \
  --deployment-revision "test-run-12345" \
  --verify-gateway --gateway-verify-poll-interval 1 --apply --json 2>&1)"
code=$?
assert_exit_code "deploy.sh --verify-gateway --apply exits 0 on success" 0 "$code"
assert_contains "deploy.sh --verify-gateway --apply started the caj-yolo-ops job" "$(cat "$ledger")" "containerapp job start"
assert_contains "deploy.sh --verify-gateway --apply reports gatewayVerification true in JSON" "$out" "\"gatewayVerification\":true"

echo "-- --verify-gateway --apply fails clearly when the ops job execution fails --"
ledger="${SCRATCH}/deploy-verifygateway-fail.ledger"
: > "$ledger"
out="$(AZ_JOB_EXECUTION_STATUS=Failed SWA_DEPLOYMENT_TOKEN=fixture-swa-token run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --site-dist "${SCRATCH}/no-such-site-dist" \
  --deployment-revision "test-run-12345" \
  --verify-gateway --gateway-verify-poll-interval 1 --apply 2>&1)"
code=$?
assert_exit_code "deploy.sh --verify-gateway --apply refuses (exit 1) when the job fails" 1 "$code"
assert_contains "deploy.sh explains the gateway verification failure" "$out" "Gateway verification failed"

echo "-- static site publish uses the pinned npx-invoked SWA CLI, never a bare 'swa' binary, and always targets the SWA production environment regardless of --environment --"
FAKE_SITE_DIST="${SCRATCH}/fake-site-dist"
mkdir -p "$FAKE_SITE_DIST"
echo "<html></html>" > "${FAKE_SITE_DIST}/index.html"

ledger="${SCRATCH}/deploy-swa-staging.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --site-dist "$FAKE_SITE_DIST" \
  --environment azure-staging 2>&1)"
code=$?
assert_exit_code "deploy.sh --environment azure-staging dry run exits 0" 0 "$code"
assert_contains "deploy.sh dry run uses the pinned npx SWA CLI package" "$out" "npx --yes @azure/static-web-apps-cli@2.0.9 deploy"
assert_contains "deploy.sh --environment azure-staging still targets SWA CLI --env production" "$out" "--env production"
assert_not_contains "deploy.sh dry run never actually shells out to npx" "$(cat "$ledger")" "npx"

ledger="${SCRATCH}/deploy-swa-production.ledger"
: > "$ledger"
out="$(run_script "$ledger" "${AZURE_DIR}/deploy.sh" \
  --gateway-image "yolocurationsprod.azurecr.io/yolo/gateway:${GATEWAY_SHA}" \
  --copilot-image "yolocurationsprod.azurecr.io/yolo/copilot-runtime:${GATEWAY_SHA}" \
  --site-dist "$FAKE_SITE_DIST" \
  --environment production 2>&1)"
code=$?
assert_exit_code "deploy.sh --environment production dry run exits 0" 0 "$code"
assert_contains "deploy.sh --environment production also targets SWA CLI --env production" "$out" "--env production"

echo
echo "== certificate.sh =="

echo "-- default mode only prints a plan, generates nothing --"
before_plan_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' 2>/dev/null | wc -l | tr -d ' ')
out="$("${AZURE_DIR}/certificate.sh" 2>&1)"
code=$?
assert_exit_code "certificate.sh default mode exits 0" 0 "$code"
assert_contains "certificate.sh plan mentions manual DNS-01" "$out" "manually creates"
after_plan_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' 2>/dev/null | wc -l | tr -d ' ')
assert_exit_code "certificate.sh plan mode creates no workdir" "$before_plan_count" "$after_plan_count"

echo "-- --generate-csr creates 0600 key material and cleans up --"
before_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' | wc -l | tr -d ' ')
out="$("${AZURE_DIR}/certificate.sh" --generate-csr --domain test.example.org 2>&1)"
code=$?
assert_exit_code "certificate.sh --generate-csr exits 0" 0 "$code"
assert_not_contains "certificate.sh never prints key contents" "$out" "BEGIN PRIVATE KEY"
assert_not_contains "certificate.sh never prints the private key's file path" "$out" ".key"
assert_contains "certificate.sh still prints the (non-sensitive) CSR path" "$out" ".csr"
after_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' | wc -l | tr -d ' ')
assert_exit_code "certificate.sh cleans up its workdir by default" "$before_count" "$after_count"

echo "-- --generate-csr --keep-workdir leaves 0600 files behind --"
out="$("${AZURE_DIR}/certificate.sh" --generate-csr --domain test.example.org --keep-workdir 2>&1)"
kept_dir="$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' | tail -n1)"
if [[ -n "$kept_dir" ]]; then
  ok "certificate.sh --keep-workdir leaves a directory behind"
  assert_file_mode "certificate.sh key file is 0600" "${kept_dir}/test.example.org.key" "600"
  rm -rf -- "$kept_dir"
else
  bad "certificate.sh --keep-workdir should have left a directory behind"
fi

echo "-- --apply without ACME client on PATH and without a Cloudflare token refuses --"
out="$(PATH="/usr/bin:/bin" CLOUDFLARE_API_TOKEN='' CLOUDFLARE_ACCOUNT_ID='' "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply refuses without certbot/acme.sh or a Cloudflare token" 1 "$code"

echo "-- --apply with wrong --confirm refuses --"
out="$("${AZURE_DIR}/certificate.sh" --apply --confirm nope 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply refuses wrong --confirm" 1 "$code"

echo "-- --apply (manual DNS-01 fallback, no Cloudflare token) forces isolated config/work/logs dirs, never prints TXT values --"
out="$(CLOUDFLARE_API_TOKEN='' CLOUDFLARE_ACCOUNT_ID='' "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply (manual, deferred) exits 0" 0 "$code"
assert_contains "certificate.sh --apply prints the isolated config-dir" "$out" "config-dir:"
assert_contains "certificate.sh --apply prints the isolated work-dir" "$out" "work-dir:"
assert_contains "certificate.sh --apply prints the isolated logs-dir" "$out" "logs-dir:"
assert_contains "certificate.sh --apply mentions --config-dir in the certbot invocation" "$out" "--config-dir"
assert_contains "certificate.sh --apply mentions --work-dir in the certbot invocation" "$out" "--work-dir"
assert_contains "certificate.sh --apply mentions --logs-dir in the certbot invocation" "$out" "--logs-dir"
assert_not_contains "certificate.sh --apply never prints a TXT challenge value" "$out" "CERTBOT_VALIDATION"
after_apply_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' 2>/dev/null | wc -l | tr -d ' ')
assert_exit_code "certificate.sh --apply cleans up its isolated working directory" "$before_count" "$after_apply_count"

echo "-- --apply (Cloudflare token present) really installs pinned certbot, issues, packages, uploads, and verifies via fixtures -- never prints secrets, and cleans up --"
before_cf_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' 2>/dev/null | wc -l | tr -d ' ')
fake_token="fixture-cloudflare-token-$$-do-not-use"
ledger="${SCRATCH}/certificate-apply-cf.ledger"
: > "$ledger"
out="$(AZ_LEDGER="$ledger" \
  CLOUDFLARE_API_TOKEN="$fake_token" \
  YOLO_CERT_PIP_BIN="${TEST_DIR}/fixtures/bin/pip" \
  YOLO_CERT_CERTBOT_BIN="${TEST_DIR}/fixtures/bin/certbot" \
  AZ_CERT_THUMBPRINT="A33D7D8B3845319BF577C7040C06C1F007EABE60" \
  "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply (Cloudflare plugin) exits 0" 0 "$code"
assert_contains "certificate.sh --apply detects CLOUDFLARE_API_TOKEN and prefers the plugin" "$out" "certbot-dns-cloudflare"
assert_contains "certificate.sh --apply prepares an isolated venv" "$out" "virtual environment"
assert_contains "certificate.sh --apply creates a 0600 Cloudflare credentials file" "$out" "cloudflare-credentials.ini"
assert_contains "certificate.sh --apply installs the pinned certbot spec" "$(cat "$ledger")" "certbot==2.11.0"
assert_contains "certificate.sh --apply installs the pinned certbot-dns-cloudflare spec" "$(cat "$ledger")" "certbot-dns-cloudflare==2.11.0"
assert_contains "certificate.sh --apply issues via 'certbot certonly'" "$(cat "$ledger")" "certonly"
assert_contains "certificate.sh --apply uploads the certificate to the Container Apps environment" "$(cat "$ledger")" "certificate upload"
assert_contains "certificate.sh --apply verifies via 'certificate list'" "$(cat "$ledger")" "certificate list"
assert_contains "certificate.sh --apply confirms the uploaded thumbprint matches the local PFX" "$out" "Verified: the uploaded certificate's thumbprint matches"
assert_not_contains "certificate.sh --apply never prints the Cloudflare token value" "$out" "$fake_token"
after_cf_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' 2>/dev/null | wc -l | tr -d ' ')
assert_exit_code "certificate.sh --apply (Cloudflare plugin) cleans up its isolated working directory" "$before_cf_count" "$after_cf_count"

echo "-- --apply (Cloudflare token present) warns (but does not fail) when the reported thumbprint does not match --"
ledger="${SCRATCH}/certificate-apply-cf-mismatch.ledger"
: > "$ledger"
out="$(AZ_LEDGER="$ledger" \
  CLOUDFLARE_API_TOKEN="$fake_token" \
  YOLO_CERT_PIP_BIN="${TEST_DIR}/fixtures/bin/pip" \
  YOLO_CERT_CERTBOT_BIN="${TEST_DIR}/fixtures/bin/certbot" \
  AZ_CERT_THUMBPRINT="0000000000000000000000000000000000000MISMATCH" \
  "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply still exits 0 on a thumbprint mismatch (non-fatal, operator must verify manually)" 0 "$code"
assert_contains "certificate.sh --apply warns when the thumbprint does not match" "$out" "Could not confirm the uploaded certificate's thumbprint"

echo "-- --apply (Cloudflare token present) surfaces a pip install failure clearly and never uploads anything --"
ledger="${SCRATCH}/certificate-apply-cf-pipfail.ledger"
: > "$ledger"
out="$(AZ_LEDGER="$ledger" \
  CLOUDFLARE_API_TOKEN="$fake_token" \
  YOLO_CERT_PIP_BIN="${TEST_DIR}/fixtures/bin/pip" \
  YOLO_CERT_CERTBOT_BIN="${TEST_DIR}/fixtures/bin/certbot" \
  PIP_FIXTURE_FAIL=1 \
  "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply refuses when pinned pip install fails" 1 "$code"
assert_not_contains "certificate.sh --apply never uploads after a failed pip install" "$(cat "$ledger")" "certificate upload"

echo "-- --apply (Cloudflare token present) surfaces a certbot ACME failure clearly and never uploads anything --"
ledger="${SCRATCH}/certificate-apply-cf-certbotfail.ledger"
: > "$ledger"
out="$(AZ_LEDGER="$ledger" \
  CLOUDFLARE_API_TOKEN="$fake_token" \
  YOLO_CERT_PIP_BIN="${TEST_DIR}/fixtures/bin/pip" \
  YOLO_CERT_CERTBOT_BIN="${TEST_DIR}/fixtures/bin/certbot" \
  CERTBOT_FIXTURE_FAIL=1 \
  "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev 2>&1)"
code=$?
assert_exit_code "certificate.sh --apply refuses when certbot issuance fails" 1 "$code"
assert_not_contains "certificate.sh --apply never uploads after a failed certbot issuance" "$(cat "$ledger")" "certificate upload"

echo "-- --apply --keep-workdir (Cloudflare token) writes a real 0600 credentials file, PFX, and password with the correct content --"
out="$(CLOUDFLARE_API_TOKEN="$fake_token" \
  YOLO_CERT_PIP_BIN="${TEST_DIR}/fixtures/bin/pip" \
  YOLO_CERT_CERTBOT_BIN="${TEST_DIR}/fixtures/bin/certbot" \
  AZ_CERT_THUMBPRINT="A33D7D8B3845319BF577C7040C06C1F007EABE60" \
  "${AZURE_DIR}/certificate.sh" --apply --confirm issue-api-curations-dev --keep-workdir 2>&1)"
kept_cert_dir="$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert.*' | tail -n1)"
if [[ -n "$kept_cert_dir" && -f "${kept_cert_dir}/cloudflare-credentials.ini" ]]; then
  ok "certificate.sh --apply --keep-workdir leaves the Cloudflare credentials file behind"
  assert_file_mode "certificate.sh Cloudflare credentials file is 0600" "${kept_cert_dir}/cloudflare-credentials.ini" "600"
  creds_content="$(cat "${kept_cert_dir}/cloudflare-credentials.ini")"
  assert_contains "certificate.sh writes the real token value into the credentials file" "$creds_content" "$fake_token"
  if [[ -d "${kept_cert_dir}/venv" ]]; then
    ok "certificate.sh creates a real Python venv inside the working directory"
  else
    bad "certificate.sh should have created a real Python venv inside the working directory"
  fi
  pfx_file="$(find "$kept_cert_dir" -maxdepth 1 -name '*.pfx' | head -1)"
  if [[ -n "$pfx_file" ]]; then
    ok "certificate.sh --apply --keep-workdir leaves the packaged PFX behind"
    assert_file_mode "certificate.sh PFX file is 0600" "$pfx_file" "600"
  else
    bad "certificate.sh --apply --keep-workdir should have left a packaged PFX behind"
  fi
  if [[ -f "${kept_cert_dir}/pfx.pass" ]]; then
    assert_file_mode "certificate.sh PFX password file is 0600" "${kept_cert_dir}/pfx.pass" "600"
  else
    bad "certificate.sh --apply --keep-workdir should have left a PFX password file behind"
  fi
  rm -rf -- "$kept_cert_dir"
else
  bad "certificate.sh --apply --keep-workdir should have left a Cloudflare credentials file behind"
fi

echo
echo "== certificate.sh --convert-to-pfx =="

CERT_MATERIAL_DIR="${SCRATCH}/pfx-source"
mkdir -p "$CERT_MATERIAL_DIR"
openssl req -x509 -newkey rsa:2048 -keyout "${CERT_MATERIAL_DIR}/test.key" -out "${CERT_MATERIAL_DIR}/test.crt" \
  -days 1 -nodes -subj "/CN=test.example.org" >/dev/null 2>&1

echo "-- converts a real cert+key into a password-protected PFX, cleans up by default --"
before_pfx_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert-pfx.*' 2>/dev/null | wc -l | tr -d ' ')
pfx_out="${CERT_MATERIAL_DIR}/test.pfx"
out="$("${AZURE_DIR}/certificate.sh" --convert-to-pfx --cert "${CERT_MATERIAL_DIR}/test.crt" --key "${CERT_MATERIAL_DIR}/test.key" --out "$pfx_out" 2>&1)"
code=$?
assert_exit_code "certificate.sh --convert-to-pfx exits 0" 0 "$code"
if [[ -f "$pfx_out" ]]; then ok "certificate.sh --convert-to-pfx creates the PFX file"; else bad "certificate.sh --convert-to-pfx creates the PFX file"; fi
assert_file_mode "certificate.sh PFX file is 0600" "$pfx_out" "600"
assert_contains "certificate.sh --convert-to-pfx says the password is never printed" "$out" "never printed"
after_pfx_count=$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert-pfx.*' 2>/dev/null | wc -l | tr -d ' ')
assert_exit_code "certificate.sh --convert-to-pfx cleans up its password working directory by default" "$before_pfx_count" "$after_pfx_count"
rm -f "$pfx_out"

echo "-- refuses when --cert is missing --"
out="$("${AZURE_DIR}/certificate.sh" --convert-to-pfx --key "${CERT_MATERIAL_DIR}/test.key" --out "${CERT_MATERIAL_DIR}/missing.pfx" 2>&1)"
code=$?
assert_exit_code "certificate.sh --convert-to-pfx refuses without --cert" 1 "$code"

echo "-- refuses when the cert file does not exist --"
out="$("${AZURE_DIR}/certificate.sh" --convert-to-pfx --cert "${CERT_MATERIAL_DIR}/does-not-exist.crt" --key "${CERT_MATERIAL_DIR}/test.key" --out "${CERT_MATERIAL_DIR}/missing.pfx" 2>&1)"
code=$?
assert_exit_code "certificate.sh --convert-to-pfx refuses a missing cert file" 1 "$code"

echo "-- --keep-workdir leaves a 0600 password file behind, and it actually unlocks the PFX (and is never echoed) --"
pfx_out2="${CERT_MATERIAL_DIR}/test-keep.pfx"
out="$("${AZURE_DIR}/certificate.sh" --convert-to-pfx --cert "${CERT_MATERIAL_DIR}/test.crt" --key "${CERT_MATERIAL_DIR}/test.key" --out "$pfx_out2" --keep-workdir 2>&1)"
kept_pfx_dir="$(find "$SCRATCH" -maxdepth 1 -name 'yolo-cert-pfx.*' | tail -n1)"
if [[ -n "$kept_pfx_dir" && -f "${kept_pfx_dir}/pfx.pass" ]]; then
  ok "certificate.sh --convert-to-pfx --keep-workdir leaves the password file behind"
  assert_file_mode "certificate.sh password file is 0600" "${kept_pfx_dir}/pfx.pass" "600"
  real_password="$(cat "${kept_pfx_dir}/pfx.pass")"
  assert_not_contains "certificate.sh never echoes the actual generated PFX password value" "$out" "$real_password"
  if openssl pkcs12 -info -in "$pfx_out2" -noout -passin "file:${kept_pfx_dir}/pfx.pass" >/dev/null 2>&1; then
    ok "certificate.sh generated PFX password file actually unlocks the PFX"
  else
    bad "certificate.sh generated PFX password file should unlock the PFX"
  fi
  rm -rf -- "$kept_pfx_dir" "$pfx_out2"
else
  bad "certificate.sh --convert-to-pfx --keep-workdir should have left a password file behind"
fi

echo "-- --password-file supplies a caller-provided password instead of generating one --"
custom_pass_dir="${SCRATCH}/custom-pass"
mkdir -p "$custom_pass_dir"
custom_passfile="${custom_pass_dir}/mypass.txt"
printf 'a-known-test-password\n' > "$custom_passfile"
chmod 0600 "$custom_passfile"
pfx_out3="${CERT_MATERIAL_DIR}/test-custompass.pfx"
out="$("${AZURE_DIR}/certificate.sh" --convert-to-pfx --cert "${CERT_MATERIAL_DIR}/test.crt" --key "${CERT_MATERIAL_DIR}/test.key" --out "$pfx_out3" --password-file "$custom_passfile" 2>&1)"
code=$?
assert_exit_code "certificate.sh --convert-to-pfx with --password-file exits 0" 0 "$code"
assert_not_contains "certificate.sh never echoes a caller-supplied password value either" "$out" "a-known-test-password"
if openssl pkcs12 -info -in "$pfx_out3" -noout -passin "file:${custom_passfile}" >/dev/null 2>&1; then
  ok "certificate.sh --convert-to-pfx honors the caller-supplied --password-file"
else
  bad "certificate.sh --convert-to-pfx should have used the caller-supplied --password-file"
fi
rm -rf -- "$pfx_out3" "$custom_pass_dir"

echo
echo "----------------------------------------"
echo "bash tests: ${PASS} passed, ${FAIL} failed"
if [[ "$FAIL" -gt 0 ]]; then
  echo "Failures:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  rm -rf -- "$SCRATCH"
  exit 1
fi
rm -rf -- "$SCRATCH"
exit 0
