// =====================================================================
// Consilium — subscription-scoped Bicep entry point.
//
// Creates rg-consilium-{env}-eus2 and provisions all RG-scoped modules.
//
// Naming:
//   Where the convention fits: consilium-{env}-eus2-<resource>
//   Where it doesn't (Azure constraints):
//     - Storage:   no hyphens allowed       -> stconsilium{token6}
//     - Key Vault: 24-char hard limit       -> kv-consilium-{env}-{token6}
//   token6 = first 6 chars of uniqueString(sub id, env, location)
//
// Search module exists at modules/search.bicep but is intentionally not
// wired in (Phase 2). Uncomment when you start the Evidence agent.
// =====================================================================

targetScope = 'subscription'

@description('Short environment name suffix (dev, stg, prod).')
@minLength(2)
@maxLength(6)
param environmentName string = 'dev'

@description('Azure region for the resource group and all resources.')
param location string = 'eastus2'

@description('Cosmos DB throughput mode.')
@allowed([
  'Serverless'
  'Provisioned'
])
param cosmosThroughputMode string = 'Serverless'

@description('TTL applied to trace items in the traces container, in seconds.')
@minValue(0)
param tracesTtlSeconds int = 604800

@description('Use managed identity (vs shared key) for Flex Consumption deployment storage.')
param useManagedIdentityStorage bool = true

var projectName = 'consilium'
var regionTag = 'eus2'
var baseName = '${projectName}-${environmentName}-${regionTag}'
var resourceGroupName = 'rg-${baseName}'
var resourceToken = substring(uniqueString(subscription().id, environmentName, location), 0, 6)

var commonTags = {
  project: projectName
  environment: environmentName
  region: regionTag
  managedBy: 'bicep'
}

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module monitor 'modules/monitor.bicep' = {
  scope: rg
  name: 'monitor-deploy'
  params: {
    location: location
    baseName: baseName
    tags: commonTags
  }
}

module keyvault 'modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-deploy'
  params: {
    location: location
    projectName: projectName
    environmentName: environmentName
    resourceToken: resourceToken
    tags: commonTags
  }
}

module storage 'modules/storage.bicep' = {
  scope: rg
  name: 'storage-deploy'
  params: {
    location: location
    projectName: projectName
    resourceToken: resourceToken
    allowSharedKeyAccess: !useManagedIdentityStorage
    tags: commonTags
  }
}

module cosmos 'modules/cosmos.bicep' = {
  scope: rg
  name: 'cosmos-deploy'
  params: {
    location: location
    baseName: baseName
    resourceToken: resourceToken
    throughputMode: cosmosThroughputMode
    tracesTtlSeconds: tracesTtlSeconds
    tags: commonTags
  }
}

module functionApp 'modules/functionApp.bicep' = {
  scope: rg
  name: 'functionApp-deploy'
  params: {
    location: location
    baseName: baseName
    resourceToken: resourceToken
    storageAccountName: storage.outputs.storageAccountName
    deploymentContainerName: storage.outputs.deploymentContainerName
    useManagedIdentityStorage: useManagedIdentityStorage
    appInsightsConnectionString: monitor.outputs.appInsightsConnectionString
    keyVaultUri: keyvault.outputs.keyVaultUri
    cosmosEndpoint: cosmos.outputs.endpoint
    cosmosDatabaseName: cosmos.outputs.databaseName
    cosmosCasesContainerName: cosmos.outputs.casesContainerName
    cosmosTracesContainerName: cosmos.outputs.tracesContainerName
    tags: commonTags
  }
}

module roleAssignments 'modules/roleAssignments.bicep' = {
  scope: rg
  name: 'roleAssignments-deploy'
  params: {
    functionAppPrincipalId: functionApp.outputs.principalId
    keyVaultName: keyvault.outputs.keyVaultName
    cosmosAccountName: cosmos.outputs.accountName
    storageAccountName: storage.outputs.storageAccountName
    grantStorageRoles: useManagedIdentityStorage
  }
}

// PHASE 2: wire Search in when the Evidence agent is ready.
// module search 'modules/search.bicep' = {
//   scope: rg
//   name: 'search-deploy'
//   params: {
//     location: location
//     baseName: baseName
//     resourceToken: resourceToken
//     tags: commonTags
//   }
// }

output resourceGroupName string = rg.name
output location string = location
output functionAppName string = functionApp.outputs.functionAppName
output functionAppHostname string = functionApp.outputs.defaultHostName
output keyVaultName string = keyvault.outputs.keyVaultName
output keyVaultUri string = keyvault.outputs.keyVaultUri
output cosmosAccountName string = cosmos.outputs.accountName
output cosmosEndpoint string = cosmos.outputs.endpoint
output storageAccountName string = storage.outputs.storageAccountName
output appInsightsConnectionString string = monitor.outputs.appInsightsConnectionString
