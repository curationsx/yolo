// runtime.bicep
//
// Repeatable, Contributor-safe entry point applied by routine CI (the
// id-yolo-github OIDC identity, which holds only Contributor on
// rg-yolo-prod and Container Registry Tasks Contributor on the registry —
// never subscription Owner or User Access Administrator). This file must
// never create identities, federated credentials, or role assignments; see
// infra/bootstrap.bicep for that Owner-only lane.
//
// Deploys/updates the three Container Apps workloads (ca-yolo-gateway,
// ca-yolo-copilot, caj-yolo-ops) inside the already-existing cae-yolo-prod
// environment, referencing the already-existing registry, Key Vault, and
// identities created by infra/bootstrap.bicep.
//
// Deploy with (id-yolo-github OIDC, or Owner for the first apply — prefer
// running through scripts/azure/deploy.sh for the routine per-deploy image
// swap + static site publish path; use the raw command below only when
// infra parameters themselves change, e.g. new CORS origins or scale
// settings):
//   az deployment group create \
//     --resource-group rg-yolo-prod \
//     --template-file infra/runtime.bicep \
//     --parameters infra/runtime.parameters.json \
//     --parameters gatewayImageTag=<acr>.azurecr.io/yolo/gateway:<git-sha> \
//     --parameters copilotImageTag=<acr>.azurecr.io/yolo/copilot-runtime:<git-sha>
//
// Validate without applying:
//   az deployment group what-if \
//     --resource-group rg-yolo-prod \
//     --template-file infra/runtime.bicep \
//     --parameters infra/runtime.parameters.json

targetScope = 'resourceGroup'

@description('Azure region (must match the existing resource group).')
param location string = resourceGroup().location

@description('Deployment environment name: azure-staging or production. Drives the default-deny gateway IP restriction and CORS origins.')
@allowed([
  'azure-staging'
  'production'
])
param environmentName string = 'azure-staging'

@description('Existing Container Registry name created by infra/bootstrap.bicep.')
param acrName string = 'yolocurationsprod'

@description('Existing Key Vault name created by infra/bootstrap.bicep.')
param keyVaultName string = 'kv-yolo-prod-curations'

@description('Existing Container Apps environment name created by infra/bootstrap.bicep.')
param containerAppsEnvironmentName string = 'cae-yolo-prod'

@description('Existing gateway user-assigned identity name created by infra/bootstrap.bicep.')
param gatewayIdentityName string = 'id-yolo-gateway'

@description('Existing Copilot runtime user-assigned identity name created by infra/bootstrap.bicep.')
param copilotIdentityName string = 'id-yolo-copilot'

@description('Immutable ACR image reference for ca-yolo-gateway, e.g. yolocurationsprod.azurecr.io/yolo/gateway:<git-sha>, produced by scripts/azure/build-images.sh. No default: every deploy must supply a real, committed Git SHA tag. Never a mutable tag such as "latest".')
param gatewayImageTag string

@description('Immutable ACR image reference for ca-yolo-copilot, e.g. yolocurationsprod.azurecr.io/yolo/copilot-runtime:<git-sha>. No default; see gatewayImageTag.')
param copilotImageTag string

@description('Immutable ACR image reference for caj-yolo-ops. Defaults to the gateway image, which carries the same operational tooling.')
param opsImageTag string = gatewayImageTag

@description('Non-secret marker (the GitHub Actions run ID) forcing a fresh Container Apps revision on every deployment, so versionless Key Vault secret references (github-client-id/github-client-secret in particular) are always re-read rather than possibly served by a still-running revision cached from a prior deploy. No default: every real deploy must supply a genuinely unique value.')
param deploymentRevision string

@description('Exact, no-wildcard CORS origin for the generated Azure Static Web Apps hostname (e.g. https://stapp-yolo-prod.azurestaticapps.net), queried by the workflow via `az staticwebapp show` immediately before this deployment. Only folded into corsAllowedOrigins default when environmentName is not production; leave empty to fall back to localhost-only. Never a wildcard.')
param stagingSiteOrigin string = ''

@description('Allowed CORS origins for the public gateway. Must list only production, the generated Azure staging hostname, and localhost where applicable.')
param corsAllowedOrigins array = environmentName == 'production'
  ? [
      'https://curations.dev'
      'https://www.curations.dev'
    ]
  : concat(
      [
        'http://localhost:4321'
      ],
      empty(stagingSiteOrigin) ? [] : [stagingSiteOrigin]
    )

@description('Cosmos DB endpoint for yolo-curations-feed (non-secret; identity-based auth). Supply from infra/bootstrap.bicep\'s cosmosAccountEndpoint output.')
param cosmosEndpoint string

@description('Azure AI Foundry endpoint for yolo-foundry (non-secret; identity-based auth). Supply from infra/bootstrap.bicep\'s foundryEndpoint output.')
param foundryEndpoint string

@description('Azure AI Foundry model deployment name, reused unchanged.')
param foundryDeploymentName string = 'gpt-5.4-mini'

@description('Cosmos SQL container name for community engagements. Matches agent-worker/wrangler.toml\'s COSMOS_CONTAINER.')
param cosmosContainerName string = 'engagements'

@description('Cosmos SQL container name for votes. Matches wrangler.toml\'s COSMOS_VOTES_CONTAINER.')
param cosmosVotesContainerName string = 'votes'

@description('Cosmos SQL container name for score metadata. Matches wrangler.toml\'s COSMOS_SCORES_CONTAINER.')
param cosmosScoresContainerName string = 'scores'

@description('Cosmos SQL container name for community discussions. Matches wrangler.toml\'s COSMOS_DISCUSSIONS_CONTAINER.')
param cosmosDiscussionsContainerName string = 'discussions'

@description('Comma-separated software cookbook targets. Matches wrangler.toml\'s SOFTWARE_TARGETS exactly.')
param softwareTargets string = 'zotero,ollama,hugging-face,n8n,langfuse,obsidian,sqlite,git,vs-code,pandoc,github,discourse,cloudflare,supabase'

@description('Vote storage backend. Matches wrangler.toml\'s VOTE_BACKEND.')
param voteBackend string = 'durable'

@description('Copilot one-use grant connection TTL in seconds. Matches wrangler.toml\'s COPILOT_CONNECTION_TTL_SECONDS.')
param copilotConnectionTtlSeconds string = '600'

@description('Wyatt\'s current staging IP in CIDR form (e.g. 203.0.113.4/32). Required whenever enableStagingIpRestriction is true.')
param wyattStagingIpCidr string = ''

@description('Pre-cutover default-deny gate for the public gateway. Remove only via an explicit production parameter set (enableStagingIpRestriction=false) after every acceptance check passes — never as an implicit default for the production environment.')
param enableStagingIpRestriction bool = true

@description('Common resource tags.')
param tags object = {
  project: 'yolo'
  environment: environmentName
  managedBy: 'bicep-runtime'
}

resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' existing = {
  name: acrName
}

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: containerAppsEnvironmentName
}

resource gatewayIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: gatewayIdentityName
}

resource copilotIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: copilotIdentityName
}

module apps 'modules/apps.bicep' = {
  name: 'yolo-apps-${environmentName}'
  params: {
    location: location
    containerAppsEnvironmentId: containerAppsEnvironment.id
    acrLoginServer: acr.properties.loginServer
    keyVaultUri: keyVault.properties.vaultUri
    gatewayIdentityId: gatewayIdentity.id
    gatewayIdentityClientId: gatewayIdentity.properties.clientId
    copilotIdentityId: copilotIdentity.id
    copilotIdentityClientId: copilotIdentity.properties.clientId
    gatewayImageTag: gatewayImageTag
    copilotImageTag: copilotImageTag
    opsImageTag: opsImageTag
    deploymentRevision: deploymentRevision
    corsAllowedOrigins: corsAllowedOrigins
    environmentName: environmentName
    cosmosEndpoint: cosmosEndpoint
    foundryEndpoint: foundryEndpoint
    foundryDeploymentName: foundryDeploymentName
    cosmosContainerName: cosmosContainerName
    cosmosVotesContainerName: cosmosVotesContainerName
    cosmosScoresContainerName: cosmosScoresContainerName
    cosmosDiscussionsContainerName: cosmosDiscussionsContainerName
    softwareTargets: softwareTargets
    voteBackend: voteBackend
    copilotConnectionTtlSeconds: copilotConnectionTtlSeconds
    wyattStagingIpCidr: wyattStagingIpCidr
    enableStagingIpRestriction: enableStagingIpRestriction
    tags: tags
  }
}

// ── Outputs consumed by scripts/azure/*.sh, scripts/azure/*.mjs, and CI ──

output environmentName string = environmentName
output resourceGroupName string = resourceGroup().name

output acrLoginServer string = acr.properties.loginServer
output keyVaultUri string = keyVault.properties.vaultUri
output containerAppsEnvironmentId string = containerAppsEnvironment.id

output gatewayAppId string = apps.outputs.gatewayAppId
output gatewayAppName string = apps.outputs.gatewayAppName
output gatewayFqdn string = apps.outputs.gatewayFqdn

output copilotAppId string = apps.outputs.copilotAppId
output copilotAppName string = apps.outputs.copilotAppName
output copilotInternalFqdn string = apps.outputs.copilotInternalFqdn

output opsJobId string = apps.outputs.opsJobId
output opsJobName string = apps.outputs.opsJobName
