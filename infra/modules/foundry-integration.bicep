// foundry-integration.bicep
//
// Cross-resource-group integration into the *existing* rg-yolo-foundry
// resources (yolo-foundry Cognitive Services account, yolo-curations-feed
// Cosmos account). Deployed by infra/bootstrap.bicep with an explicit
// `scope: resourceGroup(foundryResourceGroupName)` module reference, because
// modifying a resource group other than rg-yolo-prod requires Owner-level
// reach that the Contributor-scoped GitHub CI identity never receives.
//
// This module only *adds* role assignments and new Cosmos containers (the
// production gateway-state container, plus five fully isolated *-staging
// containers -- see their section below). It never modifies existing
// yolo-foundry or yolo-curations-feed configuration, throughput, or data.

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

@description('Entra object ID of the human bootstrap operator (from modules/identity-rbac.bicep\'s bootstrapOperatorPrincipalId output — itself defaulted to deployer().objectId). Granted Cosmos DB Built-in Data Contributor on this specific yolo-curations-feed account only, so pre/post-cutover reconciliation (scripts/azure/reconcile-scores.mjs) can authenticate keylessly from the operator\'s own machine via DefaultAzureCredential. This is a record of operator deployment access, not a service credential — no keys are read, stored, or printed anywhere in this module.')
param bootstrapOperatorPrincipalId string

@description('Isolated staging engagements container name. Independent architecture review corrected an earlier plan that reused the shared live containers for azure-staging (even with VOTE_BACKEND=kv): any staging vote/engagement/discussion document written against a real target would have changed real production counts and legacy scores. These five *-staging containers give azure-staging its own low-cost, fully isolated data, so VOTE_BACKEND can safely stay "durable" in staging too (exercising the exact production transaction path) with zero risk to live data.')
param cosmosEngagementsStagingContainerName string = 'engagements-staging'

@description('Isolated staging discussions container name. See cosmosEngagementsStagingContainerName for the full rationale.')
param cosmosDiscussionsStagingContainerName string = 'discussions-staging'

@description('Isolated staging votes container name. See cosmosEngagementsStagingContainerName for the full rationale.')
param cosmosVotesStagingContainerName string = 'votes-staging'

@description('Isolated staging scores container name. See cosmosEngagementsStagingContainerName for the full rationale.')
param cosmosScoresStagingContainerName string = 'scores-staging'

@description('Isolated staging gateway-state container name (separate from the production gateway-state container, same TTL treatment). See cosmosEngagementsStagingContainerName for the full rationale.')
param cosmosGatewayStateStagingContainerName string = 'gateway-state-staging'

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

// Operator deployment access, not a service credential: lets
// scripts/azure/reconcile-scores.mjs (which authenticates with
// DefaultAzureCredential, no keys) run keylessly from the bootstrap
// operator's own authenticated machine for authorized pre/post-cutover
// reconciliation, per .azure/deployment-plan.md. Scoped to this specific
// Cosmos account only — not subscription- or resource-group-wide.
resource bootstrapOperatorCosmosDataContributor 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, bootstrapOperatorPrincipalId, cosmosBuiltInDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosBuiltInDataContributorRoleId}'
    principalId: bootstrapOperatorPrincipalId
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

// ── Isolated azure-staging containers ──────────────────────────────────
// Five brand-new containers, entirely separate from the production
// engagements/discussions/votes/scores/gateway-state containers above.
// infra/runtime.bicep and infra/modules/apps.bicep route the gateway's
// COSMOS_*_CONTAINER env vars to these *-staging names whenever
// environmentName is azure-staging, and to the real production names
// otherwise. No pre-merge or pre-cutover staging write can ever reach a
// production document through this path -- the containers themselves are
// disjoint, not merely a different logical partition/mode within a shared
// container. This is what makes VOTE_BACKEND=durable safe in staging too
// (exercising the real production transaction/CAS code path end to end),
// which reusing the shared containers under VOTE_BACKEND=kv would not
// have been: any staging vote doc landing on a real target_id would still
// have altered that real target's production vote count and legacy score.

resource engagementsStagingContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosEngagementsStagingContainerName
  properties: {
    resource: {
      id: cosmosEngagementsStagingContainerName
      partitionKey: {
        paths: [
          '/tool_id'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource discussionsStagingContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosDiscussionsStagingContainerName
  properties: {
    resource: {
      id: cosmosDiscussionsStagingContainerName
      partitionKey: {
        paths: [
          '/tool_id'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource votesStagingContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosVotesStagingContainerName
  properties: {
    resource: {
      id: cosmosVotesStagingContainerName
      partitionKey: {
        paths: [
          '/target_id'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource scoresStagingContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosScoresStagingContainerName
  properties: {
    resource: {
      id: cosmosScoresStagingContainerName
      partitionKey: {
        paths: [
          '/scope'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource gatewayStateStagingContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: cosmosGatewayStateStagingContainerName
  properties: {
    resource: {
      id: cosmosGatewayStateStagingContainerName
      partitionKey: {
        paths: [
          '/scope'
        ]
        kind: 'Hash'
      }
      // Same TTL treatment as the production gateway-state container.
      defaultTtl: -1
    }
  }
}

output cosmosContainerId string = gatewayStateContainer.id
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint
output cognitiveServicesEndpoint string = cognitiveServicesAccount.properties.endpoint
output bootstrapOperatorCosmosDataContributorAssigned bool = true

output cosmosEngagementsStagingContainerId string = engagementsStagingContainer.id
output cosmosDiscussionsStagingContainerId string = discussionsStagingContainer.id
output cosmosVotesStagingContainerId string = votesStagingContainer.id
output cosmosScoresStagingContainerId string = scoresStagingContainer.id
output cosmosGatewayStateStagingContainerId string = gatewayStateStagingContainer.id
