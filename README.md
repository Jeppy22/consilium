# Consilium

Multi-agent clinical reasoning workbench. Five Claude agents reason about a clinical case in sequence:

1. **Historian** — structures input into a FHIR-shaped Bundle (Patient, Condition[], Observation[], MedicationStatement[]) using Claude tool calling with a `validate_fhir_bundle` tool and up to 3 self-correction retries.
2. **Differential** — ranked differential diagnoses *(Phase 2; stub in Phase 1)*
3. **Evidence** — literature retrieval via Azure AI Search *(Phase 2; stub in Phase 1)*
4. **Devil's Advocate** — adversarial review *(Phase 2; stub in Phase 1)*
5. **Synthesizer** — final reasoning note *(Phase 2; stub in Phase 1)*

## Architecture

- **Frontend** (`frontend/`) — Next.js 15 (App Router, TypeScript, Tailwind v3) deployed to Vercel. Talks to the backend through Next.js route handlers that inject `x-api-key` server-side.
- **Backend** (`functions/`) — Azure Durable Functions (TypeScript, Node v4 model). Orchestrator chains the five agent activities and persists a trace to Cosmos DB after each step.
- **Data** — Cosmos DB (`consilium` database, `cases` and `traces` containers, partition key `/caseId`). Azure AI Search wired in Phase 2.
- **Auth** — Functions reach Cosmos / Search / Key Vault via Managed Identity. Frontend ↔ Functions uses an `x-api-key` shared secret (Phase 1).
- **Secrets** — Key Vault in deployed environments. `local.settings.json` for local dev.
- **LLM** — Anthropic SDK directly, model `claude-sonnet-4-6`.
- **Region** — East US 2. Resource prefix `consilium-dev-eus2-*`.

## Repository layout

```
consilium/
├── frontend/         # Next.js 15 app
├── functions/        # Azure Durable Functions
├── infra/            # Bicep modules
├── scripts/          # seed data + smoke test helpers
├── docs/             # local-dev runbook
└── README.md
```

## Getting started

See [`docs/local-dev.md`](docs/local-dev.md).

## Design constraints

A prior attempt failed on Windows because of monorepo tooling pain. These constraints are intentional:

- **No shared TypeScript package.** Zod schemas are duplicated between `frontend/src/lib/schemas.ts` and `functions/src/lib/schemas.ts`. Keep them in sync manually.
- **No `file:..` self-references** in any `package.json`.
- **Next.js pinned to 15.x.** Do not upgrade to 16.x — Turbopack on Windows has unresolved local-module resolution issues, and Next.js 16 removed the opt-out flag. Dev server runs on webpack.
