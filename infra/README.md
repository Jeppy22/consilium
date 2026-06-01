# Consilium infrastructure

Bicep modules for the dev environment in East US (`eastus`).

> The "Azure for Students" subscription policy disallows `eastus`. To switch back to East US 2 on a different subscription, override the `location` parameter and change `regionTag` to `'eus'` in `main.bicep`.

## Topology

```
subscription
└── rg-consilium-dev-eus (East US)
    ├── consilium-dev-eus-log              Log Analytics workspace
    ├── consilium-dev-eus-appi             Application Insights (workspace-based)
    ├── kv-consilium-dev-{token6}          Key Vault (RBAC mode, purge protection ON)
    ├── stconsilium{token6}                Storage account (MI-only access)
    │     └── tables                        Consilium data plane (created at runtime)
    │           ├── cases   (PK = caseId, RK = "case")
    │           └── traces  (PK = caseId, RK = "{step}-{agent}-{status}")
    ├── consilium-dev-eus-plan             Flex Consumption plan (FC1)
    └── consilium-dev-eus-func-{token6}    Function App (System MI, Node 20)
```

> **Data store.** Cases and agent traces live in Azure Table Storage on the same storage account that hosts Durable Functions state and the Flex deployment container. Tables are created on first use by the Function App via the Tables SDK; no Bicep table-level resources are required. Cosmos DB was the prior choice but does not provision on the "Azure for Students" subscription due to a zonal capacity restriction. `modules/cosmos.bicep` remains on disk for reference but is not wired in.

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
  --location eastus `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

### What-if (dry run, shows planned changes)

```powershell
az deployment sub what-if `
  --location eastus `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

### Deploy

```powershell
$deploymentName = "consilium-dev-eus-$(Get-Date -Format yyyyMMdd-HHmmss)"

az deployment sub create `
  --name $deploymentName `
  --location eastus `
  --template-file infra/main.bicep `
  --parameters infra/main.parameters.json
```

First deploy takes ~3–5 minutes (Storage and the Flex plan are the slowest).

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
- **Storage MI-only.** `allowSharedKeyAccess: false`. The Function App's MI always gets Table Data Contributor (Consilium data plane). When `useManagedIdentityStorage=true` it also gets Blob Data Owner + Queue Data Contributor on the storage account (Durable Functions state + Flex deployment container).
- **Tables created at runtime.** The `cases` and `traces` tables are created on first use by the Function App via the Tables SDK (create-if-not-exists). No Bicep table resources required.
- **Table Storage size limits.** Each property is capped at 64 KB and an entity at 1 MB. Current agent outputs (largest ~27 KB serialized) sit comfortably under this. If a future agent's payload grows, split across chunked properties or move to Blob with a pointer.
- **KV reference resolution timing.** App settings showing `Not Resolved` immediately after first deploy are expected — they resolve once the secrets exist and the Function App is restarted.
- **Naming deviations are deliberate.** Storage cannot contain hyphens; Key Vault has a 24-char hard limit. See the header comment in `main.bicep` for the rules.

## Teardown

```powershell
az group delete --name rg-consilium-dev-eus --yes --no-wait
```

The Key Vault will be soft-deleted (90 day retention). To fully purge the KV before the retention window:

```powershell
az keyvault purge --name $kvName --location eastus
```
