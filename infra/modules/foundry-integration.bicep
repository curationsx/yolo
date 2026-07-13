// foundry-integration.bicep
//
// Cross-resource-group integration into the *existing* rg-yolo-foundry
// resources (yolo-foundry Cognitive Services account, yolo-curations-feed
// Cosmos account). Deployed by infra/bootstrap.bicep with an explicit
// `scope: resourceGroup(foundryResourceGroupName)` module reference, because
// modifying a resource group other than rg-yolo-prod requires Owner-level
// reach that the Contributor-scoped GitHub CI identity never receives.
//
// This module only *adds* a role assignment and one new Cosmos container. It
// never modifies existing yolo-foundry or yolo-curations-feed configuration,
// throughput, or data.

@description('Name of the existing Cognitive Services (AI Foundry) account, e.g. yolo-foundry.')
param cognitiveServicesAccountName string

@description('Name of the existing Cosmos DB account, e.g. yolo-curations-feed.')
param cosmosAccountName string

@description('Existing Cosmos SQL database name that already hosts the community/vote containers.')
param cosmosDatabaseName string = 'curations'

@description('New Cosmos SQL container name for gateway session/quota/grant state.')
param cosmosGatewayStateContainerName string = 'gateway-state'

@description('Partition key path for the new gateway-state container.')
param cosmosGatewayStatePartitionKeyPath string = '/scope'

@description('Principal ID of id-yolo-gateway (from modules/identity-rbac.bicep output).')
param gatewayPrincipalId string

// Built-in role definition IDs (documented, not invented).
var roleCognitiveServicesOpenAiUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
// Cosmos DB Built-in Data Contributor is a Cosmos-native SQL role definition,
// assigned via Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments, not
// a generic Microsoft.Authorization role assignment.
var cosmosBuiltInDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource cognitiveServicesAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: cognitiveServicesAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' existing = {
  parent: cosmosAccount
  name: cosmosDatabaseName
}

resource gatewayOpenAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cognitiveServicesAccount.id, gatewayPrincipalId, roleCognitiveServicesOpenAiUser)
  scope: cognitiveServicesAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCognitiveServicesOpenAiUser)
    principalId: gatewayPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource gatewayCosmosDataContributor 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, gatewayPrincipalId, cosmosBuiltInDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosBuiltInDataContributorRoleId}'
    principalId: gatewayPrincipalId
    scope: cosmosAccount.id
  }
}

resource gatewayStateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosGatewayStateContainerName
  properties: {
    resource: {
      id: cosmosGatewayStateContainerName
      partitionKey: {
        paths: [
          cosmosGatewayStatePartitionKeyPath
        ]
        kind: 'Hash'
      }
      // Default TTL enabled; individual documents (oauth/session/quota/grant)
      // set their own per-item ttl as described in the deployment plan.
      defaultTtl: -1
    }
  }
}

output cosmosContainerId string = gatewayStateContainer.id
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint
output cognitiveServicesEndpoint string = cognitiveServicesAccount.properties.endpoint
