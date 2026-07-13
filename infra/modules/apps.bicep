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

@description('Default domain of the existing cae-yolo-prod Container Apps environment (e.g. <random>.eastus2.azurecontainerapps.io), used to construct ca-yolo-gateway\'s INTERNAL fqdn for caj-yolo-ops\'s health check. Calling the gateway\'s external fqdn from inside the same environment is still subject to its ipSecurityRestrictions (confirmed: only traffic via the internal fqdn bypasses external ingress restrictions entirely); the internal fqdn avoids that path altogether rather than requiring a new same-environment allow rule.')
param containerAppsEnvironmentDefaultDomain string

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

@description('Non-secret marker (e.g. the GitHub Actions run ID) forcing a fresh Container Apps revision on every deployment. Staging and production commonly deploy the same image SHA, and the GitHub OAuth Key Vault references (github-client-id/github-client-secret) are deliberately versionless -- without a genuinely new revision, Container Apps can reuse a still-running revision whose secret values were already read from Key Vault at a previous (e.g. staging) version, silently keeping the stale OAuth secret cached through a production rollout. Passed as this template\'s revisionSuffix (the supported Container Apps mechanism for exactly this) on both ca-yolo-gateway and ca-yolo-copilot, and also surfaced as a DEPLOYMENT_REVISION env var for observability. The Key Vault secret URLs themselves are never version-pinned; a fresh revision simply guarantees each deploy actually re-reads whatever the latest version currently is.')
param deploymentRevision string

@description('Allowed CORS origins for the public gateway: production, generated Azure staging, and localhost only.')
param corsAllowedOrigins array

@description('Deployment environment name surfaced to the app as ENVIRONMENT_NAME (e.g. azure-staging, production).')
param environmentName string

@description('Cosmos DB endpoint for yolo-curations-feed (non-secret; identity-based auth).')
param cosmosEndpoint string

@description('Cosmos SQL database name.')
param cosmosDatabaseName string = 'curations'

@description('Cosmos SQL container name for gateway session/quota/grant state. Matches runtime.bicep\'s identical param default: gateway-state-staging for every non-production environmentName, gateway-state for production. This module-level default mirrors runtime.bicep\'s so a direct invocation of this module is never accidentally more permissive than the top-level entry point.')
param cosmosGatewayStateContainerName string = environmentName == 'production' ? 'gateway-state' : 'gateway-state-staging'

@description('Cosmos SQL container name for community engagements. Matches agent-worker/wrangler.toml\'s COSMOS_CONTAINER and the required cosmosContainer field in agent-worker/src/platform/azure/config.ts for production; routes to the isolated engagements-staging container (infra/modules/foundry-integration.bicep) for every non-production environmentName.')
param cosmosContainerName string = environmentName == 'production' ? 'engagements' : 'engagements-staging'

@description('Cosmos SQL container name for votes. Matches wrangler.toml\'s COSMOS_VOTES_CONTAINER for production; routes to the isolated votes-staging container for every non-production environmentName.')
param cosmosVotesContainerName string = environmentName == 'production' ? 'votes' : 'votes-staging'

@description('Cosmos SQL container name for score metadata. Matches wrangler.toml\'s COSMOS_SCORES_CONTAINER for production; routes to the isolated scores-staging container for every non-production environmentName.')
param cosmosScoresContainerName string = environmentName == 'production' ? 'scores' : 'scores-staging'

@description('Cosmos SQL container name for community discussions. Matches wrangler.toml\'s COSMOS_DISCUSSIONS_CONTAINER for production; routes to the isolated discussions-staging container for every non-production environmentName.')
param cosmosDiscussionsContainerName string = environmentName == 'production' ? 'discussions' : 'discussions-staging'

@description('Azure AI Foundry (Cognitive Services) endpoint for yolo-foundry (non-secret; identity-based auth).')
param foundryEndpoint string

@description('Azure AI Foundry model deployment name reused unchanged from the existing yolo-foundry resource.')
param foundryDeploymentName string = 'gpt-5.4-mini'

@description('Comma-separated software cookbook targets. Matches wrangler.toml\'s SOFTWARE_TARGETS exactly (order and values), required by agent-worker/src/platform/azure/config.ts.')
param softwareTargets string = 'zotero,ollama,hugging-face,n8n,langfuse,obsidian,sqlite,git,vs-code,pandoc,github,discourse,cloudflare,supabase'

@description('Vote storage backend. Always "durable" in every environment -- azure-staging runs against its own fully isolated *-staging Cosmos containers (see cosmosContainerName and friends), never the shared production containers, so there is no live-data risk in exercising the real production durable transaction/CAS path in staging too. Matches wrangler.toml\'s VOTE_BACKEND; config.ts only accepts "kv" or "durable".')
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

// Container Apps revisionSuffix must be lowercase alphanumeric/hyphens,
// start with a letter, and stay within a bounded length. deploymentRevision
// is documented as "any value unique to this run" (azure.yaml), which could
// contain colons, underscores, dots, or other characters an ad hoc caller
// might pass (a timestamp, a full git SHA with a branch prefix, etc.) --
// simple concatenation/lowercasing does not strip those. uniqueString()
// deterministically hashes the input into a fixed 13-character
// lowercase-alphanumeric string regardless of what characters
// deploymentRevision itself contains, so the suffix is always valid no
// matter the input, while still changing whenever deploymentRevision does
// (which is all that is required to force a fresh revision).
//
// environmentName is folded into the hash input too (not just
// deploymentRevision alone), as defense in depth: the calling workflow
// already passes an environment-suffixed marker
// (DEPLOYMENT_REVISION_MARKER: <run_id>-<run_attempt>-azure-staging vs.
// ...-production), but this module must not silently depend on that
// discipline. If deploymentRevision were ever identical across a staging
// and a production call in the same workflow run -- a caller bug, not
// today's actual behavior -- hashing environmentName alongside it still
// guarantees the two apps' revisionSuffix values can never collide.
var sanitizedRevisionSuffix = 'r${uniqueString('${environmentName}:${deploymentRevision}')}'

var stagingIpRestrictions = enableStagingIpRestriction ? [
  {
    name: 'allow-wyatt-staging-ip'
    description: 'Pre-cutover default-deny: only Wyatt\'s current IP may reach the public gateway.'
    ipAddressRange: wyattStagingIpCidr
    action: 'Allow'
  }
] : []

// ca-yolo-gateway's INTERNAL fqdn (as opposed to gatewayApp.properties.
// configuration.ingress.fqdn, which is the EXTERNAL fqdn). Every app in a
// Container Apps environment -- including ones with external ingress -- is
// additionally reachable at <app-name>.internal.<environment-default-domain>
// from other apps in the SAME environment, and that internal path bypasses
// external ingress (and its ipSecurityRestrictions) entirely: it never
// traverses the environment's external load balancer at all. Calling the
// EXTERNAL fqdn from inside the same environment is still subject to those
// restrictions. caj-yolo-ops uses this internal fqdn specifically so its
// gateway health check works pre-cutover without needing any new
// same-environment ipSecurityRestrictions allow rule.
var gatewayInternalFqdn = 'ca-yolo-gateway.internal.${containerAppsEnvironmentDefaultDomain}'

// Bounded (10s per route, two routes checked sequentially), read-only
// liveness/readiness check run by caj-yolo-ops. Uses only `node` (present
// on any Node-based image, including the gateway image reused here via
// opsImageTag) and Node's built-in fetch/AbortController -- no dependency
// on scripts/azure/** or any other file existing inside the image. Logs
// only the route path and HTTP status/error name, never a response body,
// header value, or any env var -- so no secret can leak into job logs.
// Exits 0 only if every route responds with an HTTP 2xx/3xx (res.ok);
// exits 1 (Container Apps job execution status becomes "Failed") on any
// timeout, network error, or non-2xx/3xx response.
var gatewayVerifyScript = '''
const base = process.env.GATEWAY_URL;
const routes = ["/api/live", "/api/ready"];
const timeoutMs = 10000;
async function check(route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(base + route, { signal: controller.signal });
    clearTimeout(timer);
    console.log(route + ": HTTP " + res.status);
    return res.ok;
  } catch (err) {
    clearTimeout(timer);
    console.error(route + ": request failed (" + err.name + ")");
    return false;
  }
}
(async () => {
  let allOk = true;
  for (const route of routes) {
    const ok = await check(route);
    if (!ok) allOk = false;
  }
  if (!allOk) {
    console.error("Gateway verification FAILED.");
    process.exit(1);
  }
  console.log("Gateway verification passed.");
  process.exit(0);
})();
'''

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
      revisionSuffix: sanitizedRevisionSuffix
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
            { name: 'DEPLOYMENT_REVISION', value: deploymentRevision }
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
      revisionSuffix: sanitizedRevisionSuffix
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
            { name: 'DEPLOYMENT_REVISION', value: deploymentRevision }
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
    }
    template: {
      containers: [
        {
          name: 'ops'
          image: opsImageTag
          // Overrides the image's default long-running gateway server CMD
          // (opsImageTag defaults to gatewayImageTag, i.e. the same image)
          // with a bounded, self-contained health check instead. Without
          // this, `az containerapp job start` would launch the gateway
          // server, which never exits, and deploy.sh's --verify-gateway
          // polling would just time out at replicaTimeout rather than ever
          // observing a real pass/fail signal.
          command: [
            'node'
            '-e'
            gatewayVerifyScript
          ]
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
            // Internal fqdn, not gatewayApp.properties.configuration.ingress.fqdn
            // (the external one) -- see gatewayInternalFqdn's comment above.
            { name: 'GATEWAY_URL', value: 'https://${gatewayInternalFqdn}' }
            // No COPILOT_RUNTIME_SHARED_SECRET here (least privilege):
            // neither the bounded health-check command above nor
            // scripts/azure/reconcile-scores.mjs (confirmed by reading it
            // fresh -- it authenticates Cosmos with
            // DefaultAzureCredential/ManagedIdentityCredential via
            // AZURE_CLIENT_ID, never a shared secret) uses it. Re-add it
            // only alongside a concrete ops job command that actually
            // consumes it.
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
