@description('Azure region.')
param location string

@description('Project short name (consilium).')
@minLength(3)
@maxLength(11)
param projectName string

@description('6-char uniqueness suffix.')
@minLength(6)
@maxLength(6)
param resourceToken string

@description('Allow shared-key access. False means MI-only (recommended).')
param allowSharedKeyAccess bool = false

@description('Common resource tags.')
param tags object

// Storage account names: 3-24 chars, lowercase letters + digits only, no hyphens.
// stconsiliumabc123 == 17 chars.
var storageAccountName = 'st${projectName}${resourceToken}'

var deploymentContainerName = 'app-package-${projectName}'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowSharedKeyAccess: allowSharedKeyAccess
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storage.name
output storageAccountId string = storage.id
output deploymentContainerName string = deploymentContainer.name
output blobEndpoint string = storage.properties.primaryEndpoints.blob
output queueEndpoint string = storage.properties.primaryEndpoints.queue
output tableEndpoint string = storage.properties.primaryEndpoints.table
