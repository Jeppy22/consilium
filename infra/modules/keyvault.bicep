@description('Azure region.')
param location string

@description('Project short name (consilium).')
param projectName string

@description('Environment name (dev, stg, prod).')
param environmentName string

@description('6-char uniqueness suffix.')
param resourceToken string

@description('Common resource tags.')
param tags object

// 24-char hard limit on Key Vault names. kv-consilium-dev-abc123 == 22 chars.
var keyVaultName = 'kv-${projectName}-${environmentName}-${resourceToken}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    // PERMANENT: purge protection cannot be disabled once enabled.
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output keyVaultName string = keyVault.name
output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
