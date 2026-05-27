# Consilium scripts

Test data and ops helpers for the Consilium multi-agent pipeline.

| File | Purpose |
| --- | --- |
| `test-cases.json` | 10 hand-curated clinical vignettes (cases 001–010), with `expected_diagnosis` and `differential_should_include` annotations for the future eval harness. Temperatures are in **Celsius** (matches the schema). |
| `smoke-test.ps1` | Submit one case, poll until terminal, pretty-print agent traces. Default case: `case-001-acs`. PowerShell. |
| `smoke-test.sh`  | Bash equivalent of `smoke-test.ps1`. Requires `jq` and `curl`. |
| `seed-cases.ps1` | Submit **all** cases sequentially. Prints a summary table at the end. |

## Prerequisites

- Functions host running at the target URL (locally: `func start` from `functions/` with Azurite running)
- `functions/local.settings.json` populated with a non-placeholder `CONSILIUM_API_KEY` and `ANTHROPIC_API_KEY`
- PowerShell 5.1+ (Windows default) or PowerShell 7+ for the `.ps1` scripts
- For `smoke-test.sh`: bash 4+, `jq`, `curl`

## smoke-test.ps1

```powershell
# Default case (case-001-acs), local Functions host, 120s timeout
pwsh scripts/smoke-test.ps1

# Different case
pwsh scripts/smoke-test.ps1 -CaseId case-004-dka

# Against the deployed Function App
pwsh scripts/smoke-test.ps1 `
  -BaseUrl https://consilium-dev-eus-func-abc123.azurewebsites.net `
  -TimeoutSeconds 300
```

**Parameters**
- `-CaseId` — `case_id` from `test-cases.json`. Default `case-001-acs`.
- `-BaseUrl` — Functions host base URL. Default `http://localhost:7071`.
- `-TimeoutSeconds` — total polling deadline. Default `120`.

**Exit codes**
- `0` — orchestrator reached `Completed`
- `1` — `Failed` / `Terminated` / HTTP error / timeout / bad input

**Output**
A timestamped runtime-status log while polling, then a per-agent summary:
```
=== Final (Completed, 12.4s) ===

[ok] step 1 historian  (11.2s)
     {
       "bundle": { ... truncated to 20 lines ... },
       "attempts": 1,
       ...
     }
[ok] step 2 differential  (0.1s)
     ...
```

## smoke-test.sh

```bash
chmod +x scripts/smoke-test.sh

scripts/smoke-test.sh                            # default case
scripts/smoke-test.sh case-004-dka               # specific case
scripts/smoke-test.sh case-004-dka --base-url https://example.azurewebsites.net --timeout 300
scripts/smoke-test.sh --help
```

Same semantics and exit codes as the PowerShell version. Per-agent output preview is minimal in the bash version (status line only — use the PowerShell script for the JSON preview).

## seed-cases.ps1

Runs every case sequentially. Useful as a load smoke test before Phase 2 / eval-harness work.

```powershell
pwsh scripts/seed-cases.ps1
pwsh scripts/seed-cases.ps1 -BaseUrl http://localhost:7071 -PerCaseTimeoutSeconds 180
```

**Output** — a summary table:

```
case_id            expected_diagnosis              runtime_status duration_s attempts note
-------            ------------------              -------------- ---------- -------- ----
case-001-acs       Acute coronary syndrome         Completed            12.4        1
case-002-pe        Pulmonary embolism              Completed            10.9        1
case-003-cap       Community-acquired pneumonia    Completed             9.7        1
...
passed: 10 / 10
```

Exit `0` if every case completes, `1` otherwise.

> Cases run **sequentially** to avoid hammering the local Functions host. For
> parallel runs (e.g., against the deployed Function App), wrap a list of
> case_ids around `smoke-test.ps1` with `ForEach-Object -Parallel`.

## How these fit the Phase 2 eval harness

Phase 2 introduces an **eval harness** that scores the Differential agent's output against `expected_diagnosis` and `differential_should_include`. The harness will:

1. Reuse `test-cases.json` as the canonical case fixture set
2. Reuse the submit + poll flow that lives in `seed-cases.ps1` (likely lifted into a TypeScript driver under `eval/`)
3. Inspect each case's final orchestrator output, locate the Differential agent's `ranked_diagnoses` array, and compute pass / partial / fail per the scoring rules in `test-cases.json` → `metadata.scoring_guide`
4. Persist results to Cosmos or to a `eval/results/<run-id>.json` file for trending

The current scripts are stepping stones — they prove the submit/poll loop works and exercise the orchestrator under realistic load. The eval harness will keep their submit/poll bones and add scoring.

## Troubleshooting

- **`401 Unauthorized`** — `CONSILIUM_API_KEY` in `local.settings.json` doesn't match what your script sends. Make sure you didn't restart the Functions host with a stale value.
- **`400 Invalid clinical input` with `temp` issues** — should never happen now (test data is in Celsius), but if you add a new case make sure temps are 20–45 C.
- **Timeout** — orchestrator stuck. Check Functions terminal output for errors; check Azurite is running (`tasklist | findstr azurite`).
- **`functions/local.settings.json not found`** — copy `functions/local.settings.json.example` to `functions/local.settings.json` and fill in the values.
- **PowerShell execution policy** — first run on a fresh Windows machine may need: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
