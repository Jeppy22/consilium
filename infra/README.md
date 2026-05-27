# Consilium infrastructure

Bicep modules for the dev environment in East US 2.

## Topology

```
subscription
└── rg-consilium-dev-eus2 (East US 2)
    ├── consilium-dev-eus2-log              Log Analytics workspace
    ├── consilium-dev-eus2-appi             Application Insights (workspace-based)
    ├── kv-consilium-dev-{token6}           Key Vault (RBAC mode, purge protection ON)
    ├── stconsilium{token6}                 Storage account (MI-only access)
    ├── consilium-dev-eus2-cosmos-{token6}  Cosmos DB NoSQL account (Serverless, AAD-only)
    │     └── database "consilium"
    │           ├── container "cases"   (PK /caseId)
    │           └── container "traces"  (PK /caseId, TTL 7 days)
    ├── consilium-dev-eus2-plan             Flex Consumption plan (FC1)
    └── consilium-dev-eus2-func-{token6}    Function App (System MI, Node 20)
```

`{token6}` is the first 6 chars of `uniqueString(subscription().id, environmentName, location)`.

**Search is intentionally not provisioned in Phase 1.** `modules/search.bicep` exists but is commented out in `main.bicep`. Wire it in for the Evidence agent in Phase 2.

## Prerequisites

- Azure CLI 2.60+ (`az --version`)
- Logged in to the target subscription (`az login`, `az account set --subscription <id>`)
- The deploying principal needs `Owner` or `Contributor` + `User Access Administrator` on the target subscription (to create role assignments)
- Bicep CLI (bundled with `az` 2.20+)

## Deploy

All commands run from the **repo root** with the `infra/` paths shown.

### Validate (no resources created)

```powershell
az deployment sub validate `
  --location eastus2 `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

### What-if (dry run, shows planned changes)

```powershell
az deployment sub what-if `
  --location eastus2 `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

### Deploy

```powershell
$deploymentName = "consilium-dev-eus2-$(Get-Date -Format yyyyMMdd-HHmmss)"

az deployment sub create `
  --name $deploymentName `
  --location eastus2 `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

First deploy takes ~5–8 minutes (Cosmos and Storage are the slowest).

### Read outputs

```powershell
az deployment sub show --name $deploymentName --query 'properties.outputs' -o json
```

## Post-deploy steps

### 1. Seed Key Vault secrets

The Function App's `ANTHROPIC_API_KEY` and `CONSILIUM_API_KEY` app settings reference Key Vault but the secrets don't exist yet — they must be added manually so the references resolve.

```powershell
$outputs = az deployment sub show --name $deploymentName --query 'properties.outputs' -o json | ConvertFrom-Json
$kvName  = $outputs.keyVaultName.value
$funcName = $outputs.functionAppName.value
$rgName  = $outputs.resourceGroupName.value

az keyvault secret set --vault-name $kvName --name ANTHROPIC-API-KEY --value "sk-ant-REPLACE-WITH-REAL-KEY"
az keyvault secret set --vault-name $kvName --name CONSILIUM-API-KEY --value "$(New-Guid)"
```

Restart the Function App so it picks up the resolved KV references:

```powershell
az functionapp restart --name $funcName --resource-group $rgName
```

Verify both references resolved:

```powershell
az functionapp config appsettings list --name $funcName --resource-group $rgName `
  --query "[?name=='ANTHROPIC_API_KEY' || name=='CONSILIUM_API_KEY']"
```

Both should show a `value` matching the `@Microsoft.KeyVault(...)` syntax — the resolved state is visible in the Azure portal under **Configuration**.

### 2. Deploy function code

From the repo root:

```powershell
Set-Location functions
npm ci
npm run build
func azure functionapp publish $funcName
Set-Location ..
```

Wait ~1–2 minutes for the deployment to settle.

### 3. Smoke test

```powershell
$consiliumKey = az keyvault secret show --vault-name $kvName --name CONSILIUM-API-KEY --query value -o tsv
$hostname = $outputs.functionAppHostname.value

# (Phase E will add scripts/sample-case.json and scripts/smoke-test.ps1)
```

## Notes and gotchas

- **Purge protection is permanent.** Once `enablePurgeProtection: true` is deployed, it cannot be turned off. Deleting the KV requires waiting out the 90-day soft-delete window or an admin purge with the right perms.
- **Cosmos AAD-only.** `disableLocalAuth: true` means connection strings won't work — only the FA's managed identity can read/write. If you need to query from the Azure portal Data Explorer, assign your user the Cosmos DB Built-in Data Contributor role on the account.
- **Storage MI-only.** `allowSharedKeyAccess: false`. The Function App's MI gets Blob Data Owner + Queue Data Contributor + Table Data Contributor on the storage account (the three Durable Functions needs for state + the Flex deployment container).
- **KV reference resolution timing.** App settings showing `Not Resolved` immediately after first deploy are expected — they resolve once the secrets exist and the Function App is restarted.
- **Traces TTL = 7 days (604800 s).** Override with `--parameters tracesTtlSeconds=<seconds>` or by editing `main.parameters.json`. Set to `0` to disable (treated as `defaultTtl: -1` = TTL on but no automatic expiry).
- **Naming deviations are deliberate.** Storage cannot contain hyphens; Key Vault has a 24-char hard limit. See the header comment in `main.bicep` for the rules.

## Teardown

```powershell
az group delete --name rg-consilium-dev-eus2 --yes --no-wait
```

The Key Vault and Cosmos account will be soft-deleted (90 day retention). To fully purge the KV before the retention window:

```powershell
az keyvault purge --name $kvName --location eastus2
```
