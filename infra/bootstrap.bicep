// bootstrap.bicep
//
// OWNER-ONLY entry point. Do not apply this file from routine GitHub Actions
// CI — the GitHub OIDC identity created here (id-yolo-github) never receives
// permission to run it again. Only a human signed in with subscription
// Owner / User Access Administrator rights (or equivalent) runs this file,
// and only when identities, federation, or cross-resource RBAC actually need
// to change.
//
// Responsibilities:
//   1. Create rg-yolo-prod.
//   2. Deploy the foundation resources that RBAC in this file targets
//      (registry, Key Vault, Log Analytics, Container Apps environment,
//      Static Web App) via modules/foundation.bicep.
//   3. Create the three user-assigned identities and the GitHub OIDC
//      federated credentials (environment-scoped, not branch wildcards).
//   4. Grant every cross-resource-group and in-resource-group RBAC role
//      required by the plan, including the Cosmos-native SQL role
//      assignment and the Cognitive Services role on the existing
//      rg-yolo-foundry resources.
//   5. Create the new `gateway-state` Cosmos container.
//   6. Declare the alert-only monthly budget covering both resource groups.
//
// infra/runtime.bicep is the separate, repeatable, Contributor-safe entry
// point that routine CI applies for every deploy (container app revisions,
// image tags). It never creates identities, federated credentials, or role
// assignments.
//
// Deploy with (Owner-authenticated az login required — prefer running
// through scripts/azure/bootstrap.sh, which performs prerequisite, quota,
// and Owner-role checks before invoking this exact command):
//   az deployment sub create \
//     --location eastus2 \
//     --template-file infra/bootstrap.bicep \
//     --parameters infra/main.parameters.json
//
// Validate without applying:
//   az deployment sub what-if \
//     --location eastus2 \
//     --template-file infra/bootstrap.bicep \
//     --parameters infra/main.parameters.json

targetScope = 'subscription'

@description('Primary region for all new resources.')
param location string = 'eastus2'

@description('Name of the new resource group hosting the Yolo Azure production surface.')
param resourceGroupName string = 'rg-yolo-prod'

@description('Name of the existing resource group hosting yolo-foundry and yolo-curations-feed.')
param foundryResourceGroupName string = 'rg-yolo-foundry'

@description('Name of the existing Azure AI Foundry (Cognitive Services) account reused unchanged.')
param cognitiveServicesAccountName string = 'yolo-foundry'

@description('Name of the existing Cosmos DB account reused unchanged, plus one new container.')
param cosmosAccountName string = 'yolo-curations-feed'

@description('Name of the new Azure Container Registry (Basic, admin + anonymous pull disabled).')
param acrName string = 'yolocurationsprod'

@description('Name of the new Key Vault (RBAC authorization, soft delete + purge protection).')
param keyVaultName string = 'kv-yolo-prod-curations'

@description('Name of the new Log Analytics workspace (30-day retention, 0.1 GB/day cap).')
param logAnalyticsName string = 'log-yolo-prod'

@description('Name of the new Container Apps (Consumption) managed environment.')
param containerAppsEnvironmentName string = 'cae-yolo-prod'

@description('Name of the new Static Web App (Free tier).')
param staticWebAppName string = 'stapp-yolo-prod'

@description('Name of the gateway user-assigned identity.')
param gatewayIdentityName string = 'id-yolo-gateway'

@description('Name of the Copilot runtime user-assigned identity.')
param copilotIdentityName string = 'id-yolo-copilot'

@description('Name of the GitHub Actions deployment (OIDC) user-assigned identity.')
param githubIdentityName string = 'id-yolo-github'

@description('GitHub repository in "owner/repo" form allowed to federate as id-yolo-github.')
param githubRepo string = 'curationsx/yolo'

@description('GitHub environments (not branches) allowed to federate as id-yolo-github.')
param githubEnvironments array = [
  'azure-staging'
  'production'
]

@description('Alert-only monthly budget amount in USD. Applied to rg-yolo-prod (and, in the unified filter, rg-yolo-foundry too — see budgetUseUnifiedFilter) so real project spend in the reused Foundry/Cosmos resource group is not silently excluded from budget coverage.')
param budgetAmount int = 8

@description('Preferred: one subscription-scope budget filtered to both rg-yolo-prod and rg-yolo-foundry via a single ResourceGroupName "In" dimension filter (validated in this subscription with both `az deployment sub what-if` and `az deployment sub validate` — no policy violation observed). Fallback: set to false only if a real `az deployment sub create` ever rejects that multi-RG filter (e.g. a policy that only enforces at create-time, not validate/what-if) — this deploys two independent single-RG-filtered budgets instead, so rg-yolo-foundry coverage is never silently dropped.')
param budgetUseUnifiedFilter bool = true

@description('Contact emails for budget alert notifications at 50/80/100%. Leave empty to skip creating any budget (e.g. for a syntax-only what-if run) rather than deploy an alert nobody receives.')
param budgetContactEmails array = []

@description('Budget schedule start date (must be the first day of a month, UTC midnight). Defaults to a fixed anchor so repeat bootstrap runs do not shift the recurrence window.')
param budgetStartDate string = '2026-01-01T00:00:00Z'

@description('Entra object ID of the human/service principal running this bootstrap deployment, granted Key Vault Secrets Officer at kv-yolo-prod-curations. This is required because the vault uses RBAC authorization: subscription Owner alone does not imply Key Vault data-plane access, so `az keyvault secret set` would otherwise fail for the Owner running Stage 1/3/4 of the deployment plan. Every runtime/CI identity stays Key Vault Secrets User (read-only). Defaults to the deployer\'s own object ID — discovered automatically via the deployer() function, not hard-coded to any specific person — so this only needs to be overridden if bootstrap is run on behalf of a different operator (equivalent to `az ad signed-in-user show --query id -o tsv` for whoever authenticates the `az deployment sub create` call).')
param bootstrapOperatorPrincipalId string = deployer().objectId

@description('Principal type of bootstrapOperatorPrincipalId. "User" (default) for an interactive human Owner; set to "ServicePrincipal" only if bootstrap is ever run by an automated, non-CI, Owner-equivalent identity.')
@allowed([
  'User'
  'ServicePrincipal'
])
param bootstrapOperatorPrincipalType string = 'User'

@description('Common resource tags applied to every new resource.')
param tags object = {
  project: 'yolo'
  environment: 'production'
  managedBy: 'bicep-bootstrap'
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module foundation 'modules/foundation.bicep' = {
  name: 'yolo-foundation'
  scope: rg
  params: {
    location: location
    acrName: acrName
    keyVaultName: keyVaultName
    logAnalyticsName: logAnalyticsName
    containerAppsEnvironmentName: containerAppsEnvironmentName
    staticWebAppName: staticWebAppName
    tags: tags
  }
}

module identities 'modules/identity-rbac.bicep' = {
  name: 'yolo-identity-rbac'
  scope: rg
  params: {
    location: location
    gatewayIdentityName: gatewayIdentityName
    copilotIdentityName: copilotIdentityName
    githubIdentityName: githubIdentityName
    githubRepo: githubRepo
    githubEnvironments: githubEnvironments
    keyVaultName: foundation.outputs.keyVaultName
    acrName: foundation.outputs.acrName
    bootstrapOperatorPrincipalId: bootstrapOperatorPrincipalId
    bootstrapOperatorPrincipalType: bootstrapOperatorPrincipalType
    tags: tags
  }
}

module foundryIntegration 'modules/foundry-integration.bicep' = {
  name: 'yolo-foundry-integration'
  scope: resourceGroup(foundryResourceGroupName)
  params: {
    cognitiveServicesAccountName: cognitiveServicesAccountName
    cosmosAccountName: cosmosAccountName
    gatewayPrincipalId: identities.outputs.gatewayIdentityPrincipalId
    bootstrapOperatorPrincipalId: identities.outputs.bootstrapOperatorPrincipalId
  }
}

// Budget notification block is identical across every budget resource below
// (unified or split) — defined once to avoid drift between them.
var budgetNotifications = {
  alert50: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: 50
    contactEmails: budgetContactEmails
    thresholdType: 'Actual'
  }
  alert80: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: 80
    contactEmails: budgetContactEmails
    thresholdType: 'Actual'
  }
  alert100: {
    enabled: true
    operator: 'GreaterThanOrEqualTo'
    threshold: 100
    contactEmails: budgetContactEmails
    thresholdType: 'Actual'
  }
}

var budgetTimePeriod = {
  startDate: budgetStartDate
  endDate: dateTimeAdd(budgetStartDate, 'P10Y')
}

// PREFERRED: one subscription-scope budget filtered to both rg-yolo-prod and
// rg-yolo-foundry via a single ResourceGroupName "In" dimension filter, so
// the reused Foundry/Cosmos resource group's real spend is not silently
// excluded from coverage. Validated in this subscription with both
// `az deployment sub what-if` and `az deployment sub validate` — no policy
// violation observed. Skipped (no resource emitted) when no contact email
// is supplied or when the split fallback is selected.
resource budgetUnified 'Microsoft.Consumption/budgets@2023-05-01' = if (!empty(budgetContactEmails) && budgetUseUnifiedFilter) {
  name: 'budget-yolo-prod'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: budgetTimePeriod
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          resourceGroupName
          foundryResourceGroupName
        ]
      }
    }
    notifications: budgetNotifications
  }
  dependsOn: [
    rg
  ]
}

// FALLBACK: if a real deploy ever rejects the multi-RG filter above
// (budgetUseUnifiedFilter=false), keep the original rg-yolo-prod-only
// budget AND surface a second, independently filtered budget for
// rg-yolo-foundry, rather than silently dropping that resource group's
// coverage. Each budget alerts independently at 50/80/100% of the same
// $8 threshold against its own resource group's spend.
resource budgetProdOnly 'Microsoft.Consumption/budgets@2023-05-01' = if (!empty(budgetContactEmails) && !budgetUseUnifiedFilter) {
  name: 'budget-yolo-prod'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: budgetTimePeriod
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          resourceGroupName
        ]
      }
    }
    notifications: budgetNotifications
  }
  dependsOn: [
    rg
  ]
}

resource budgetFoundryOnly 'Microsoft.Consumption/budgets@2023-05-01' = if (!empty(budgetContactEmails) && !budgetUseUnifiedFilter) {
  name: 'budget-yolo-foundry'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: budgetTimePeriod
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          foundryResourceGroupName
        ]
      }
    }
    notifications: budgetNotifications
  }
}

// ── Outputs consumed by scripts/azure/*.sh, scripts/azure/*.mjs, and CI ──

output resourceGroupName string = rg.name
output location string = location

output acrName string = foundation.outputs.acrName
output acrLoginServer string = foundation.outputs.acrLoginServer
output acrId string = foundation.outputs.acrId

output keyVaultName string = foundation.outputs.keyVaultName
output keyVaultUri string = foundation.outputs.keyVaultUri
output keyVaultId string = foundation.outputs.keyVaultId

output logAnalyticsName string = foundation.outputs.logAnalyticsName
output logAnalyticsId string = foundation.outputs.logAnalyticsId

output containerAppsEnvironmentName string = foundation.outputs.containerAppsEnvironmentName
output containerAppsEnvironmentId string = foundation.outputs.containerAppsEnvironmentId
output containerAppsEnvironmentDefaultDomain string = foundation.outputs.containerAppsEnvironmentDefaultDomain

output staticWebAppName string = foundation.outputs.staticWebAppName
output staticWebAppId string = foundation.outputs.staticWebAppId
output staticWebAppDefaultHostname string = foundation.outputs.staticWebAppDefaultHostname

output gatewayIdentityId string = identities.outputs.gatewayIdentityId
output gatewayIdentityClientId string = identities.outputs.gatewayIdentityClientId
output gatewayIdentityPrincipalId string = identities.outputs.gatewayIdentityPrincipalId

output copilotIdentityId string = identities.outputs.copilotIdentityId
output copilotIdentityClientId string = identities.outputs.copilotIdentityClientId
output copilotIdentityPrincipalId string = identities.outputs.copilotIdentityPrincipalId

output githubIdentityId string = identities.outputs.githubIdentityId
output githubIdentityClientId string = identities.outputs.githubIdentityClientId
output githubIdentityPrincipalId string = identities.outputs.githubIdentityPrincipalId

output bootstrapOperatorPrincipalId string = identities.outputs.bootstrapOperatorPrincipalId

output cosmosGatewayStateContainerId string = foundryIntegration.outputs.cosmosContainerId
output cosmosAccountEndpoint string = foundryIntegration.outputs.cosmosAccountEndpoint
output foundryEndpoint string = foundryIntegration.outputs.cognitiveServicesEndpoint

output budgetDeployed bool = !empty(budgetContactEmails)
// Explicit, machine-readable coverage status so nothing about budget
// coverage is ever silently assumed by a script or a future reviewer:
//   - 'none': budgetContactEmails was empty; no budget resource was created.
//   - 'unified-multi-rg': one budget-yolo-prod resource, ResourceGroupName
//     "In" [rg-yolo-prod, rg-yolo-foundry] — both resource groups covered.
//   - 'split-per-rg': budgetUseUnifiedFilter was set to false (fallback);
//     budget-yolo-prod and budget-yolo-foundry both exist, independently
//     covering their own resource group.
output budgetMode string = empty(budgetContactEmails)
  ? 'none'
  : (budgetUseUnifiedFilter ? 'unified-multi-rg' : 'split-per-rg')
output budgetCoversRgYoloProd bool = !empty(budgetContactEmails)
output budgetCoversRgYoloFoundry bool = !empty(budgetContactEmails)
// NOTE: if a future review decides even the ResourceGroupName "In" filter is
// unsafe for this subscription's policy posture, do not invent an
// alternative Bicep construct — set budgetUseUnifiedFilter=false (the
// split-per-rg fallback above already handles it) or fall back to the
// documented Azure Budgets REST/CLI hook in scripts/azure/bootstrap.sh
// (owned by the scripts/azure lane) and record that decision here.
