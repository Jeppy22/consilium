@description('System-assigned principal ID of the Function App.')
param functionAppPrincipalId string

@description('Key Vault name (RG-scoped).')
param keyVaultName string

@description('Cosmos DB account name (RG-scoped).')
param cosmosAccountName string

@description('Storage account name (RG-scoped).')
param storageAccountName string

@description('Grant Blob/Queue/Table data roles on the storage account. Only needed when AzureWebJobsStorage uses managed identity.')
param grantStorageRoles bool = true

// ---- Built-in role IDs ----
// Azure RBAC roles (subscription-scoped definitions)
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
// Cosmos DB SQL data plane roles (account-scoped definitions)
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

// ---- Key Vault: Secrets User ----
resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, functionAppPrincipalId, kvSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---- Cosmos DB: Built-in Data Contributor (data plane RBAC) ----
resource cosmosDataContributorAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, functionAppPrincipalId, cosmosDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: functionAppPrincipalId
    scope: cosmosAccount.id
  }
}

// ---- Storage: Blob/Queue/Table data roles (Flex deployment + Durable state) ----
resource storageBlobDataOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (grantStorageRoles) {
  scope: storage
  name: guid(storage.id, functionAppPrincipalId, storageBlobDataOwnerRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storageQueueDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (grantStorageRoles) {
  scope: storage
  name: guid(storage.id, functionAppPrincipalId, storageQueueDataContributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storageTableDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (grantStorageRoles) {
  scope: storage
  name: guid(storage.id, functionAppPrincipalId, storageTableDataContributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}
