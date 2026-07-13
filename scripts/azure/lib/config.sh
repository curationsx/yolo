#!/usr/bin/env bash
# scripts/azure/lib/config.sh
#
# Single source of truth for Azure resource names used by scripts/azure/**.
# Values mirror .azure/deployment-plan.md exactly. Every value is overridable
# via environment variable so tests can point at fixture names without
# touching real infrastructure.
#
# This file only sets variables. It must never print anything and must never
# be executed directly (source it).

# Guard against direct execution.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "config.sh must be sourced, not executed" >&2
  exit 1
fi

: "${AZURE_SUBSCRIPTION_ID:=86d88839-c524-4816-8af4-3a30045271e1}"
: "${AZURE_TENANT_ID:=e2080a46-068c-44d3-a2c4-aa27a5d8d8d1}"
: "${AZURE_LOCATION:=eastus2}"

: "${YOLO_RESOURCE_GROUP:=rg-yolo-prod}"
: "${YOLO_FOUNDRY_RESOURCE_GROUP:=rg-yolo-foundry}"

: "${YOLO_STATIC_WEB_APP:=stapp-yolo-prod}"
: "${YOLO_CONTAINERAPPS_ENV:=cae-yolo-prod}"
: "${YOLO_GATEWAY_APP:=ca-yolo-gateway}"
: "${YOLO_COPILOT_APP:=ca-yolo-copilot}"
: "${YOLO_OPS_JOB:=caj-yolo-ops}"
: "${YOLO_ACR_NAME:=yolocurationsprod}"
: "${YOLO_KEY_VAULT:=kv-yolo-prod-curations}"
: "${YOLO_LOG_WORKSPACE:=log-yolo-prod}"
: "${YOLO_GATEWAY_IDENTITY:=id-yolo-gateway}"
: "${YOLO_COPILOT_IDENTITY:=id-yolo-copilot}"
: "${YOLO_GITHUB_IDENTITY:=id-yolo-github}"
: "${YOLO_BUDGET:=budget-yolo-prod}"
: "${YOLO_BUDGET_AMOUNT:=8}"
# Non-secret (but not committed to any params file): infra/bootstrap.bicep's
# budgetContactEmails defaults to an empty array, which intentionally
# skips creating the $8 budget entirely (see budgetContactEmails's
# @description). bootstrap.sh requires this to be supplied at apply time
# via --budget-contact-email or this env var, then passes it inline to
# `az deployment sub create` -- it is never written to source control.
: "${YOLO_BUDGET_CONTACT_EMAIL:=}"

: "${YOLO_FOUNDRY_ACCOUNT:=yolo-foundry}"
: "${YOLO_COSMOS_ACCOUNT:=yolo-curations-feed}"
: "${YOLO_COSMOS_DATABASE:=curations}"
: "${YOLO_COSMOS_VOTES_CONTAINER:=votes}"
: "${YOLO_COSMOS_SCORES_CONTAINER:=scores}"
: "${YOLO_COSMOS_GATEWAY_STATE_CONTAINER:=gateway-state}"

: "${YOLO_PRODUCTION_DOMAIN:=curations.dev}"
: "${YOLO_PRODUCTION_WWW_DOMAIN:=www.curations.dev}"
: "${YOLO_API_DOMAIN:=api.curations.dev}"
: "${YOLO_PAGES_TARGET:=curations-dev.pages.dev}"

: "${YOLO_GITHUB_REPOSITORY:=curationsx/yolo}"
: "${YOLO_GITHUB_ENVIRONMENTS:=azure-staging,production}"

: "${YOLO_MIN_CONSUMPTION_CORES:=2.1}"

export AZURE_SUBSCRIPTION_ID AZURE_TENANT_ID AZURE_LOCATION
export YOLO_RESOURCE_GROUP YOLO_FOUNDRY_RESOURCE_GROUP
export YOLO_STATIC_WEB_APP YOLO_CONTAINERAPPS_ENV YOLO_GATEWAY_APP YOLO_COPILOT_APP
export YOLO_OPS_JOB YOLO_ACR_NAME YOLO_KEY_VAULT YOLO_LOG_WORKSPACE
export YOLO_GATEWAY_IDENTITY YOLO_COPILOT_IDENTITY YOLO_GITHUB_IDENTITY
export YOLO_BUDGET YOLO_BUDGET_AMOUNT YOLO_BUDGET_CONTACT_EMAIL
export YOLO_FOUNDRY_ACCOUNT YOLO_COSMOS_ACCOUNT YOLO_COSMOS_DATABASE
export YOLO_COSMOS_VOTES_CONTAINER YOLO_COSMOS_SCORES_CONTAINER YOLO_COSMOS_GATEWAY_STATE_CONTAINER
export YOLO_PRODUCTION_DOMAIN YOLO_PRODUCTION_WWW_DOMAIN YOLO_API_DOMAIN YOLO_PAGES_TARGET
export YOLO_GITHUB_REPOSITORY YOLO_GITHUB_ENVIRONMENTS
export YOLO_MIN_CONSUMPTION_CORES
