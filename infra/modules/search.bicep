// =====================================================================
// Azure AI Search — PHASE 2.
//
// This module is intentionally NOT wired into main.bicep yet. Wire it in
// when the Evidence agent is ready. To enable:
//   1. Uncomment the `module search ...` block in main.bicep.
//   2. Pass the search endpoint/admin key to the Function App app settings.
//   3. Grant the FA managed identity a data-plane role on the search service.
// =====================================================================

@description('Azure region.')
param location string

@description('Base name: consilium-{env}-eus.')
param baseName string

@description('6-char uniqueness suffix.')
param resourceToken string

@description('SKU tier for the search service.')
@allowed([
  'free'
  'basic'
  'standard'
  'standard2'
  'standard3'
])
param sku string = 'basic'

@description('Common resource tags.')
param tags object

var searchName = '${baseName}-search-${resourceToken}'

resource search 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: searchName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    semanticSearch: 'free'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http403'
      }
    }
    // Phase 2 may flip to disableLocalAuth: true once the Evidence agent
    // is fully AAD-wired. Leaving off for first deploy convenience.
    disableLocalAuth: false
  }
}

output searchServiceName string = search.name
output searchServiceId string = search.id
output searchEndpoint string = 'https://${search.name}.search.windows.net'
