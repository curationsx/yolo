// identity-rbac.bicep
//
// Resource-group-scoped identities, GitHub OIDC federation, and the
// in-resource-group RBAC assignments that depend on them. Deployed by
// infra/bootstrap.bicep only. Creating federated credentials and role
// assignments requires elevated (Owner / User Access Administrator)
// permission that the routine CI identity (id-yolo-github) intentionally
// never receives — see infra/bootstrap.bicep and .github/workflows/azure-deploy.yml.

@description('Azure region for the user-assigned identities.')
param location string

@description('Name of the gateway (ca-yolo-gateway) user-assigned identity.')
param gatewayIdentityName string

@description('Name of the Copilot runtime (ca-yolo-copilot) user-assigned identity.')
param copilotIdentityName string

@description('Name of the GitHub Actions deployment (OIDC) user-assigned identity.')
param githubIdentityName string

@description('GitHub repository in "owner/repo" form allowed to federate as id-yolo-github.')
param githubRepo string = 'curationsx/yolo'

@description('GitHub environments (not branches) allowed to federate as id-yolo-github.')
param githubEnvironments array = [
  'azure-staging'
  'production'
]

@description('Existing Key Vault name (created by modules/foundation.bicep in the same bootstrap deployment).')
param keyVaultName string

@description('Existing Container Registry name (created by modules/foundation.bicep in the same bootstrap deployment).')
param acrName string

@description('Entra object ID of the human/service principal running infra/bootstrap.bicep, granted Key Vault Secrets Officer (read+write) at this vault only, so the Owner can actually set secret values on an RBAC-authorization vault — subscription Owner alone does not imply Key Vault data-plane access. Defaults to the deployer\'s own object ID (discovered automatically, not hard-coded); override only if bootstrap is being run on behalf of a different operator.')
param bootstrapOperatorPrincipalId string = deployer().objectId

@description('Principal type of bootstrapOperatorPrincipalId. Defaults to "User" (a human Owner running the deployment interactively); set to "ServicePrincipal" if bootstrap is ever run by an automated, non-CI, Owner-equivalent identity.')
@allowed([
  'User'
  'ServicePrincipal'
])
param bootstrapOperatorPrincipalType string = 'User'

@description('Common resource tags.')
param tags object = {}

// Built-in role definition IDs (documented, not invented).
var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleKeyVaultSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var roleAcrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var roleContributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var roleContainerRegistryTasksContributor = 'fb382eab-e894-4461-af04-94435c366c3f'

resource gatewayIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: gatewayIdentityName
  location: location
  tags: tags
}

resource copilotIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: copilotIdentityName
  location: location
  tags: tags
}

resource githubIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: githubIdentityName
  location: location
  tags: tags
}

// One federated credential per allowed GitHub environment. Subject is
// restricted to `repo:<org>/<repo>:environment:<name>` — explicitly not a
// branch wildcard (`repo:org/repo:ref:refs/heads/*`), and deliberately NOT
// a bare `repo:<org>/<repo>:pull_request` subject either: that subject
// would let this Contributor-scoped identity mint an Azure OIDC token from
// ANY pull_request workflow run in this repository (including, once
// runnable, fork PRs) with no environment or branch-policy gate in front of
// it. A PR-only read-only "verify" job must instead validate Bicep locally
// (az bicep build) with no Azure credential at all — see
// .github/workflows/azure-deploy.yml. Live `what-if` stays exclusively
// behind workflow_dispatch + an explicitly human-approved, branch-policy
// -restricted GitHub environment (azure-staging or production).
// Azure rejects concurrent federated-credential writes beneath one managed
// identity, so this loop must remain serialized.
@batchSize(1)
resource githubFederatedCredentials 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2024-11-30' = [for envName in githubEnvironments: {
  parent: githubIdentity
  name: 'gh-${envName}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepo}:environment:${envName}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}]

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' existing = {
  name: acrName
}

// RBAC-authorization Key Vaults grant subscription Owner no implicit
// data-plane access — `az keyvault secret set` fails for Owner alone.
// Grant only the bootstrap operator write access (Secrets Officer); every
// runtime/CI identity below stays read-only (Secrets User).
resource bootstrapOperatorKeyVaultSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, bootstrapOperatorPrincipalId, roleKeyVaultSecretsOfficer)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsOfficer)
    principalId: bootstrapOperatorPrincipalId
    principalType: bootstrapOperatorPrincipalType
  }
}

resource gatewayKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, gatewayIdentity.id, roleKeyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: gatewayIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource gatewayAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, gatewayIdentity.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: gatewayIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource copilotKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, copilotIdentity.id, roleKeyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: copilotIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource copilotAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, copilotIdentity.id, roleAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
    principalId: copilotIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Contributor on the resource group only — never subscription Owner or User
// Access Administrator. This is the sole scope routine CI can deploy into.
resource githubContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubIdentity.id, roleContributor)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleContributor)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubAcrTasksContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, githubIdentity.id, roleContainerRegistryTasksContributor)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleContainerRegistryTasksContributor)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output gatewayIdentityId string = gatewayIdentity.id
output gatewayIdentityPrincipalId string = gatewayIdentity.properties.principalId
output gatewayIdentityClientId string = gatewayIdentity.properties.clientId

output copilotIdentityId string = copilotIdentity.id
output copilotIdentityPrincipalId string = copilotIdentity.properties.principalId
output copilotIdentityClientId string = copilotIdentity.properties.clientId

output githubIdentityId string = githubIdentity.id
output githubIdentityPrincipalId string = githubIdentity.properties.principalId
output githubIdentityClientId string = githubIdentity.properties.clientId

output bootstrapOperatorPrincipalId string = bootstrapOperatorPrincipalId
