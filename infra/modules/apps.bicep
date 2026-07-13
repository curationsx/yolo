// apps.bicep
//
// Resource-group-scoped Container Apps (gateway, Copilot runtime) and the
// manual operations Job. Deployed repeatedly by infra/runtime.bicep — this
// module intentionally creates no identities, RBAC, or federated
// credentials, so it stays inside what the Contributor-scoped GitHub CI
// identity (id-yolo-github) is allowed to apply.

@description('Azure region for the container apps and job.')
param location string

@description('Resource ID of the existing cae-yolo-prod Container Apps environment.')
param containerAppsEnvironmentId string

@description('Login server of the existing yolocurationsprod registry, e.g. yolocurationsprod.azurecr.io.')
param acrLoginServer string

@description('URI of the existing kv-yolo-prod-curations Key Vault, e.g. https://kv-yolo-prod-curations.vault.azure.net/.')
param keyVaultUri string

@description('Resource ID of the id-yolo-gateway user-assigned identity.')
param gatewayIdentityId string

@description('Client ID of the id-yolo-gateway user-assigned identity.')
param gatewayIdentityClientId string

@description('Resource ID of the id-yolo-copilot user-assigned identity.')
param copilotIdentityId string

@description('Client ID of the id-yolo-copilot user-assigned identity.')
param copilotIdentityClientId string

@description('Immutable ACR image reference (repo:git-sha, e.g. yolo/gateway:<sha>, produced by scripts/azure/build-images.sh) for ca-yolo-gateway. Never a mutable tag such as "latest".')
param gatewayImageTag string

@description('Immutable ACR image reference for ca-yolo-copilot, e.g. yolo/copilot-runtime:<sha>.')
param copilotImageTag string

@description('Immutable ACR image reference for caj-yolo-ops. Defaults to the gateway image, which carries the same operational tooling.')
param opsImageTag string = gatewayImageTag

@description('Allowed CORS origins for the public gateway: production, generated Azure staging, and localhost only.')
param corsAllowedOrigins array

@description('Deployment environment name surfaced to the app as ENVIRONMENT_NAME (e.g. azure-staging, production).')
param environmentName string

@description('Cosmos DB endpoint for yolo-curations-feed (non-secret; identity-based auth).')
param cosmosEndpoint string

@description('Cosmos SQL database name.')
param cosmosDatabaseName string = 'curations'

@description('Cosmos SQL container name for gateway session/quota/grant state.')
param cosmosGatewayStateContainerName string = 'gateway-state'

@description('Cosmos SQL container name for community engagements. Matches agent-worker/wrangler.toml\'s COSMOS_CONTAINER and the required cosmosContainer field in agent-worker/src/platform/azure/config.ts.')
param cosmosContainerName string = 'engagements'

@description('Cosmos SQL container name for votes. Matches wrangler.toml\'s COSMOS_VOTES_CONTAINER.')
param cosmosVotesContainerName string = 'votes'

@description('Cosmos SQL container name for score metadata. Matches wrangler.toml\'s COSMOS_SCORES_CONTAINER.')
param cosmosScoresContainerName string = 'scores'

@description('Cosmos SQL container name for community discussions. Matches wrangler.toml\'s COSMOS_DISCUSSIONS_CONTAINER.')
param cosmosDiscussionsContainerName string = 'discussions'

@description('Azure AI Foundry (Cognitive Services) endpoint for yolo-foundry (non-secret; identity-based auth).')
param foundryEndpoint string

@description('Azure AI Foundry model deployment name reused unchanged from the existing yolo-foundry resource.')
param foundryDeploymentName string = 'gpt-5.4-mini'

@description('Comma-separated software cookbook targets. Matches wrangler.toml\'s SOFTWARE_TARGETS exactly (order and values), required by agent-worker/src/platform/azure/config.ts.')
param softwareTargets string = 'zotero,ollama,hugging-face,n8n,langfuse,obsidian,sqlite,git,vs-code,pandoc,github,discourse,cloudflare,supabase'

@description('Vote storage backend. Matches wrangler.toml\'s VOTE_BACKEND; config.ts only accepts "kv" or "durable" and defaults to "durable" for anything else.')
param voteBackend string = 'durable'

@description('Copilot one-use grant connection TTL in seconds. Matches wrangler.toml\'s COPILOT_CONNECTION_TTL_SECONDS.')
param copilotConnectionTtlSeconds string = '600'

@description('Before production cutover, restrict ca-yolo-gateway ingress to only this CIDR (Wyatt\'s current IP). Required whenever enableStagingIpRestriction is true.')
param wyattStagingIpCidr string = ''

@description('Default-deny gate. Must be explicitly set to false only for the production cutover parameter set, after every acceptance check passes.')
param enableStagingIpRestriction bool = true

@description('Common resource tags.')
param tags object = {}

// Both match agent-worker/copilot-runtime/server.mjs's confirmed
// `process.env.PORT ?? "8080"` default. PORT is also passed explicitly to
// each container below so ingress targetPort and the actual listening port
// stay in lockstep regardless of what default any future gateway server
// implementation picks (agent-worker/src/platform/azure/server.ts has not
// landed yet as of this writing).
var gatewayTargetPort = 8080
var copilotTargetPort = 8080

var stagingIpRestrictions = enableStagingIpRestriction ? [
  {
    name: 'allow-wyatt-staging-ip'
    description: 'Pre-cutover default-deny: only Wyatt\'s current IP may reach the public gateway.'
    ipAddressRange: wyattStagingIpCidr
    action: 'Allow'
  }
] : []

resource gatewayApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: 'ca-yolo-gateway'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${gatewayIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: gatewayTargetPort
        transport: 'auto'
        allowInsecure: false
        ipSecurityRestrictions: stagingIpRestrictions
      }
      registries: [
        {
          server: acrLoginServer
          identity: gatewayIdentityId
        }
      ]
      secrets: [
        {
          name: 'github-client-id'
          keyVaultUrl: '${keyVaultUri}secrets/github-client-id'
          identity: gatewayIdentityId
        }
        {
          name: 'github-client-secret'
          keyVaultUrl: '${keyVaultUri}secrets/github-client-secret'
          identity: gatewayIdentityId
        }
        {
          name: 'copilot-token-encryption-key'
          keyVaultUrl: '${keyVaultUri}secrets/copilot-token-encryption-key'
          identity: gatewayIdentityId
        }
        {
          name: 'copilot-runtime-shared-secret'
          keyVaultUrl: '${keyVaultUri}secrets/copilot-runtime-shared-secret'
          identity: gatewayIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'gateway'
          image: gatewayImageTag
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'AZURE_CLIENT_ID', value: gatewayIdentityClientId }
            { name: 'PORT', value: string(gatewayTargetPort) }
            { name: 'ENVIRONMENT_NAME', value: environmentName }
            // Env var names below are aligned exactly with the
            // Cloudflare-compatible contract in agent-worker/wrangler.toml
            // and enforced (fail-fast on start-up) by
            // agent-worker/src/platform/azure/config.ts's loadAzureConfig.
            // Do not rename these without updating both files in that lane.
            { name: 'ALLOWED_ORIGINS', value: join(corsAllowedOrigins, ',') }
            { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
            { name: 'COSMOS_GATEWAY_STATE_CONTAINER', value: cosmosGatewayStateContainerName }
            { name: 'COSMOS_CONTAINER', value: cosmosContainerName }
            { name: 'COSMOS_VOTES_CONTAINER', value: cosmosVotesContainerName }
            { name: 'COSMOS_SCORES_CONTAINER', value: cosmosScoresContainerName }
            { name: 'COSMOS_DISCUSSIONS_CONTAINER', value: cosmosDiscussionsContainerName }
            { name: 'AZURE_OPENAI_ENDPOINT', value: foundryEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: foundryDeploymentName }
            { name: 'SOFTWARE_TARGETS', value: softwareTargets }
            { name: 'VOTE_BACKEND', value: voteBackend }
            { name: 'COPILOT_CONNECTION_TTL_SECONDS', value: copilotConnectionTtlSeconds }
            { name: 'COPILOT_RUNTIME_URL', value: 'https://${copilotApp.properties.configuration.ingress.fqdn}' }
            { name: 'GITHUB_CLIENT_ID', secretRef: 'github-client-id' }
            { name: 'GITHUB_CLIENT_SECRET', secretRef: 'github-client-secret' }
            { name: 'COPILOT_TOKEN_ENCRYPTION_KEY', secretRef: 'copilot-token-encryption-key' }
            { name: 'COPILOT_RUNTIME_SHARED_SECRET', secretRef: 'copilot-runtime-shared-secret' }
          ]
          // Paths match the gateway's PLANNED health contract in
          // .azure/deployment-plan.md ("Error and Health Contract"):
          // /api/live, /api/ready, /api/health. agent-worker/src/platform/
          // azure/server.ts had not landed as of this writing; update these
          // paths if that lane's implementation diverges from the plan.
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/live', port: gatewayTargetPort }
              initialDelaySeconds: 5
              periodSeconds: 15
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/ready', port: gatewayTargetPort }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource copilotApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: 'ca-yolo-copilot'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${copilotIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: copilotTargetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: copilotIdentityId
        }
      ]
      secrets: [
        {
          name: 'copilot-runtime-shared-secret'
          keyVaultUrl: '${keyVaultUri}secrets/copilot-runtime-shared-secret'
          identity: copilotIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'copilot-runtime'
          image: copilotImageTag
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'AZURE_CLIENT_ID', value: copilotIdentityClientId }
            { name: 'PORT', value: string(copilotTargetPort) }
            { name: 'ENVIRONMENT_NAME', value: environmentName }
            { name: 'COPILOT_RUNTIME_SHARED_SECRET', secretRef: 'copilot-runtime-shared-secret' }
          ]
          // agent-worker/copilot-runtime/server.mjs (confirmed as of this
          // writing) exposes exactly one route, GET /health, and 404s
          // everything else including /api/ready — so liveness and
          // readiness both point at /health rather than the gateway's
          // three-endpoint planned contract.
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: copilotTargetPort }
              initialDelaySeconds: 5
              periodSeconds: 15
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: copilotTargetPort }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            // One concurrent request per replica, per the deployment plan's
            // scale table.
            name: 'single-concurrency'
            http: {
              metadata: {
                concurrentRequests: '1'
              }
            }
          }
        ]
      }
    }
  }
}

resource opsJob 'Microsoft.App/jobs@2025-01-01' = {
  name: 'caj-yolo-ops'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${gatewayIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acrLoginServer
          identity: gatewayIdentityId
        }
      ]
      secrets: [
        {
          name: 'copilot-runtime-shared-secret'
          keyVaultUrl: '${keyVaultUri}secrets/copilot-runtime-shared-secret'
          identity: gatewayIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ops'
          image: opsImageTag
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'AZURE_CLIENT_ID', value: gatewayIdentityClientId }
            { name: 'ENVIRONMENT_NAME', value: environmentName }
            { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
            { name: 'COSMOS_GATEWAY_STATE_CONTAINER', value: cosmosGatewayStateContainerName }
            { name: 'GATEWAY_URL', value: 'https://${gatewayApp.properties.configuration.ingress.fqdn}' }
            { name: 'COPILOT_RUNTIME_SHARED_SECRET', secretRef: 'copilot-runtime-shared-secret' }
          ]
        }
      ]
    }
  }
}

output gatewayAppId string = gatewayApp.id
output gatewayAppName string = gatewayApp.name
output gatewayFqdn string = gatewayApp.properties.configuration.ingress.fqdn

output copilotAppId string = copilotApp.id
output copilotAppName string = copilotApp.name
output copilotInternalFqdn string = copilotApp.properties.configuration.ingress.fqdn

output opsJobId string = opsJob.id
output opsJobName string = opsJob.name
