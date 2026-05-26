# Local development runbook

> This document grows phase-by-phase as the scaffold progresses. Sections marked *(coming in Phase X)* are placeholders.

## Prerequisites

- **Node.js** 20 LTS or newer (Node 24 LTS recommended to match the deployed Functions runtime)
- **npm** 10+
- **Azure Functions Core Tools v4** — `npm i -g azure-functions-core-tools@4 --unsafe-perm true`
- **Azurite** (Azure Storage emulator) for Durable Functions local state — `npm i -g azurite`, then run `azurite` in a separate terminal
- **Anthropic API key** — get one at https://console.anthropic.com
- *(Optional, for deployment)* **Azure CLI** — `winget install Microsoft.AzureCLI`
- *(Optional, for deployment)* **Vercel CLI** — `npm i -g vercel`

## Repository layout

```
consilium/
├── frontend/         # Next.js 15 app (Phase C)
├── functions/        # Azure Durable Functions (Phase B)
├── infra/            # Bicep modules (Phase D)
├── scripts/          # seed + smoke-test helpers (Phase E)
├── docs/
└── README.md
```

## Environment variables

### `functions/local.settings.json`
*(coming in Phase B)* — copy `functions/local.settings.json.example` to `functions/local.settings.json` and fill in:
- `ANTHROPIC_API_KEY` — your Anthropic key
- `CONSILIUM_API_KEY` — any random string; the frontend must send the same value as `x-api-key`
- `COSMOS_ENDPOINT`, `COSMOS_KEY` — local or cloud Cosmos; or leave blank to use an in-memory fallback (Phase B detail TBD)

### `frontend/.env.local`
*(coming in Phase C)* — copy `frontend/.env.local.example` and fill in:
- `FUNCTIONS_BASE_URL` — typically `http://localhost:7071`
- `CONSILIUM_API_KEY` — must match the Functions value

## Running locally

### 1. Start Azurite (Durable Functions state)
```powershell
azurite --silent --location .azurite --debug .azurite/debug.log
```

### 2. Start the Functions host
```powershell
cd functions
npm install
npm run build
npm start
```
Functions will be available at `http://localhost:7071`.

### 3. Start the Next.js dev server
```powershell
cd frontend
npm install
npm run dev
```
App will be available at `http://localhost:3000`.

> **Note:** dev server uses webpack, not Turbopack. Do not pass `--turbo`. Turbopack on Windows has unresolved local-module resolution issues; this is intentional.

## Smoke test
*(coming in Phase E)* — `pwsh scripts/smoke-test.ps1` will POST a sample case to the local Functions host and poll the status endpoint until the orchestrator completes.

## Deployment
*(coming in Phase D)* — Bicep templates in `infra/` deploy to Azure via `az deployment sub create`. Frontend deploys to Vercel separately.

## Troubleshooting

- **"file:../shared not found"** — this should not happen. Schemas are intentionally duplicated; if you see this error, someone added a forbidden `file:` dependency. See [`README.md`](../README.md) → Design constraints.
- **Turbopack errors on Windows** — run `next dev` without `--turbo`. If `package.json` has been changed to use `--turbo`, revert it.
