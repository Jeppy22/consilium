<#
.SYNOPSIS
  Submit ALL cases from test-cases.json sequentially and print a summary table.

.DESCRIPTION
  Runs each case end-to-end against the local (or supplied) Functions host,
  extracts attempts from the Historian trace, and prints a markdown-ish
  summary table at the end. Useful as a pre-Phase-2 smoke test of the
  orchestrator under load.

  Exit codes:
    0 - every case Completed
    1 - one or more cases did not Complete

.PARAMETER BaseUrl
  Base URL of the Functions host. Default: http://localhost:7071.

.PARAMETER PerCaseTimeoutSeconds
  Per-case timeout. Default: 120.

.EXAMPLE
  pwsh scripts/seed-cases.ps1
  pwsh scripts/seed-cases.ps1 -BaseUrl http://localhost:7071 -PerCaseTimeoutSeconds 180
#>
[CmdletBinding()]
param(
  [string] $BaseUrl = 'http://localhost:7071',
  [int]    $PerCaseTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'

$repoRoot     = Split-Path -Parent $PSScriptRoot
$casesPath    = Join-Path $PSScriptRoot 'test-cases.json'
$settingsPath = Join-Path $repoRoot 'functions/local.settings.json'

function Write-Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $casesPath))    { Write-Fail "test-cases.json not found at $casesPath" }
if (-not (Test-Path $settingsPath)) { Write-Fail "functions/local.settings.json not found." }

$apiKey = (Get-Content $settingsPath -Raw | ConvertFrom-Json).Values.CONSILIUM_API_KEY
if (-not $apiKey -or $apiKey -eq 'local-dev-shared-secret-change-me') {
  Write-Fail "CONSILIUM_API_KEY in functions/local.settings.json is empty or still the placeholder."
}

$cases    = (Get-Content $casesPath -Raw | ConvertFrom-Json).cases
$terminal = @('Completed', 'Failed', 'Terminated')
$headers  = @{ 'x-api-key' = $apiKey; 'content-type' = 'application/json' }
$results  = @()

Write-Host "[seed] Submitting $($cases.Count) cases sequentially against $BaseUrl" -ForegroundColor Cyan

foreach ($case in $cases) {
  Write-Host ""
  Write-Host "[seed] $($case.case_id) - $($case.expected_diagnosis)" -ForegroundColor Cyan

  $caseStart    = Get-Date
  $status       = $null
  $attempts     = $null
  $errorMessage = $null

  try {
    $body         = $case.input | ConvertTo-Json -Depth 10 -Compress
    $startResp    = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/cases" -Headers $headers -Body $body
    $statusUrl    = "$BaseUrl/api/cases/$($startResp.caseId)/status?instanceId=$($startResp.instanceId)"
    $deadline     = (Get-Date).AddSeconds($PerCaseTimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
      try {
        $status = Invoke-RestMethod -Method Get -Uri $statusUrl -Headers @{ 'x-api-key' = $apiKey }
      } catch {
        Start-Sleep -Seconds 2
        continue
      }
      if ($terminal -contains $status.runtimeStatus) { break }
      Start-Sleep -Seconds 2
    }

    if (-not $status -or -not ($terminal -contains $status.runtimeStatus)) {
      $errorMessage = "timeout (last: $($status.runtimeStatus))"
    } else {
      $historianTrace = $status.traces |
        Where-Object { $_.agent -eq 'historian' -and $_.status -eq 'completed' } |
        Select-Object -First 1
      if ($historianTrace -and $null -ne $historianTrace.output.attempts) {
        $attempts = $historianTrace.output.attempts
      }
    }
  } catch {
    $errorMessage = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $errorMessage = "$errorMessage | $($_.ErrorDetails.Message)"
    }
  }

  $duration      = [math]::Round(((Get-Date) - $caseStart).TotalSeconds, 1)
  $runtimeStatus = if ($status) { $status.runtimeStatus } else { 'Error' }

  $results += [pscustomobject]@{
    case_id            = $case.case_id
    expected_diagnosis = $case.expected_diagnosis
    runtime_status     = $runtimeStatus
    duration_s         = $duration
    attempts           = if ($null -ne $attempts) { $attempts } else { '-' }
    note               = if ($errorMessage) { $errorMessage } else { '' }
  }

  $tagColor = if ($runtimeStatus -eq 'Completed') { 'Green' } else { 'Red' }
  Write-Host "       $runtimeStatus in ${duration}s$(if ($attempts) { ' (attempts=' + $attempts + ')' })" -ForegroundColor $tagColor
}

Write-Host ""
Write-Host "==== Summary ====" -ForegroundColor Cyan
$results | Format-Table -AutoSize -Property case_id, expected_diagnosis, runtime_status, duration_s, attempts, note

$passed = ($results | Where-Object { $_.runtime_status -eq 'Completed' }).Count
$total  = $results.Count
$resColor = if ($passed -eq $total) { 'Green' } else { 'Yellow' }
Write-Host ""
Write-Host "passed: $passed / $total" -ForegroundColor $resColor

if ($passed -lt $total) { exit 1 } else { exit 0 }
