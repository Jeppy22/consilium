@description('Azure region.')
param location string

@description('Base name: consilium-{env}-eus2.')
param baseName string

@description('6-char uniqueness suffix.')
param resourceToken string

@description('Cosmos throughput mode.')
@allowed([
  'Serverless'
  'Provisioned'
])
param throughputMode string = 'Serverless'

@description('Throughput (RU/s) for the database when Provisioned. Ignored for Serverless.')
@minValue(400)
param provisionedDatabaseThroughput int = 400

@description('TTL on the traces container in seconds. 0 disables.')
@minValue(0)
param tracesTtlSeconds int

@description('Common resource tags.')
param tags object

var accountName = '${baseName}-cosmos-${resourceToken}'
var databaseName = 'consilium'
var casesContainerName = 'cases'
var tracesContainerName = 'traces'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: throughputMode == 'Serverless' ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    // AAD-only — disable local (key-based) auth.
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
    options: throughputMode == 'Provisioned' ? {
      throughput: provisionedDatabaseThroughput
    } : {}
  }
}

resource casesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: casesContainerName
  properties: {
    resource: {
      id: casesContainerName
      partitionKey: {
        paths: [
          '/caseId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

resource tracesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: tracesContainerName
  properties: {
    resource: {
      id: tracesContainerName
      partitionKey: {
        paths: [
          '/caseId'
        ]
        kind: 'Hash'
      }
      defaultTtl: tracesTtlSeconds == 0 ? -1 : tracesTtlSeconds
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

output accountName string = cosmosAccount.name
output accountId string = cosmosAccount.id
output endpoint string = cosmosAccount.properties.documentEndpoint
output databaseName string = database.name
output casesContainerName string = casesContainer.name
output tracesContainerName string = tracesContainer.name
