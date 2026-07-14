// foundation.bicep
//
// Resource-group-scoped foundation resources for the Yolo Azure migration.
// Deployed once by infra/bootstrap.bicep (Owner run). Not repeatable-safe for
// routine CI because it is only ever applied alongside the Owner-only
// identity/RBAC bootstrap — see infra/bootstrap.bicep for the entry point.
//
// Creates: Container Registry (Basic), Key Vault (RBAC), Log Analytics
// workspace (capped), Container Apps environment, and the Static Web App
// shell. Application content and container app revisions are deployed later
// by infra/runtime.bicep and the CI/CD workflow.

@description('Azure region for all resources in this module.')
param location string

@description('Name of the Azure Container Registry (Basic, admin + anonymous pull disabled).')
param acrName string

@description('Name of the Key Vault (RBAC authorization, soft delete + purge protection).')
param keyVaultName string

@description('Name of the Log Analytics workspace backing the Container Apps environment.')
param logAnalyticsName string

@description('Name of the Container Apps (Consumption) managed environment.')
param containerAppsEnvironmentName string

@description('Name of the Static Web App (Free tier) serving the Astro catalog.')
param staticWebAppName string

@description('Common resource tags.')
param tags object = {}

@description('Log Analytics daily ingestion cap in GB. Keeps steady-state cost near zero.')
param logAnalyticsDailyQuotaGb string = '0.1'

@description('Log Analytics retention in days.')
param logAnalyticsRetentionDays int = 30

resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    accessPolicies: []
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logAnalyticsRetentionDays
    workspaceCapping: {
      dailyQuotaGb: json(logAnalyticsDailyQuotaGb)
    }
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    // Consumption-only environment: no workload profiles declared, matches
    // the Consumption plan required for both container apps and the job.
    zoneRedundant: false
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Content is published post-deploy by the CI workflow (Astro build
    // output), not by this Bicep module. No repository/branch binding is
    // configured here to avoid coupling infra to a build pipeline.
    provider: 'None'
  }
}

output acrId string = acr.id
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output logAnalyticsId string = logAnalytics.id
output logAnalyticsName string = logAnalytics.name
output logAnalyticsCustomerId string = logAnalytics.properties.customerId

output containerAppsEnvironmentId string = containerAppsEnvironment.id
output containerAppsEnvironmentName string = containerAppsEnvironment.name
output containerAppsEnvironmentDefaultDomain string = containerAppsEnvironment.properties.defaultDomain

output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
