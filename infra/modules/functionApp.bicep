@description('Azure region.')
param location string

@description('Base name: consilium-{env}-eus.')
param baseName string

@description('6-char uniqueness suffix.')
param resourceToken string

@description('Storage account name (deployment + WebJobs state).')
param storageAccountName string

@description('Blob container that hosts the function code package.')
param deploymentContainerName string

@description('Use managed identity (vs shared key) for deployment storage auth.')
param useManagedIdentityStorage bool = true

@description('App Insights connection string.')
param appInsightsConnectionString string

@description('Key Vault URI, e.g. https://kv.../')
param keyVaultUri string

@description('Cosmos DB document endpoint.')
param cosmosEndpoint string

@description('Cosmos database name.')
param cosmosDatabaseName string

@description('Cosmos cases container name.')
param cosmosCasesContainerName string

@description('Cosmos traces container name.')
param cosmosTracesContainerName string

@description('Common resource tags.')
param tags object

var planName = '${baseName}-plan'
var functionAppName = '${baseName}-func-${resourceToken}'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true
  }
}

var deploymentStorageAuthentication = useManagedIdentityStorage ? {
  type: 'SystemAssignedIdentity'
} : {
  type: 'StorageAccountConnectionString'
  storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
}

var managedIdentityWebJobsSettings = [
  {
    name: 'AzureWebJobsStorage__credential'
    value: 'managedidentity'
  }
  {
    name: 'AzureWebJobsStorage__blobServiceUri'
    value: storage.properties.primaryEndpoints.blob
  }
  {
    name: 'AzureWebJobsStorage__queueServiceUri'
    value: storage.properties.primaryEndpoints.queue
  }
  {
    name: 'AzureWebJobsStorage__tableServiceUri'
    value: storage.properties.primaryEndpoints.table
  }
]

var sharedKeyWebJobsSettings = [
  {
    name: 'AzureWebJobsStorage'
    value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
  }
  {
    name: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
    value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
  }
]

var consiliumSettings = [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'ANTHROPIC_API_KEY'
    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ANTHROPIC-API-KEY)'
  }
  {
    name: 'CONSILIUM_API_KEY'
    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/CONSILIUM-API-KEY)'
  }
  {
    name: 'COSMOS_ENDPOINT'
    value: cosmosEndpoint
  }
  {
    name: 'COSMOS_DATABASE'
    value: cosmosDatabaseName
  }
  {
    name: 'COSMOS_CASES_CONTAINER'
    value: cosmosCasesContainerName
  }
  {
    name: 'COSMOS_TRACES_CONTAINER'
    value: cosmosTracesContainerName
  }
]

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: deploymentStorageAuthentication
        }
      }
      runtime: {
        name: 'node'
        version: '20'
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: union(
        consiliumSettings,
        useManagedIdentityStorage ? managedIdentityWebJobsSettings : sharedKeyWebJobsSettings
      )
    }
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output defaultHostName string = functionApp.properties.defaultHostName
output principalId string = functionApp.identity.principalId
