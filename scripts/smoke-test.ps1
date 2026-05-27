<#
.SYNOPSIS
  Submit one Consilium test case and poll until terminal status.

.DESCRIPTION
  Reads CONSILIUM_API_KEY from functions/local.settings.json, picks a case
  from scripts/test-cases.json by case_id, POSTs it to the local Functions
  host (or a supplied BaseUrl), then polls the status endpoint until the
  orchestrator reaches Completed, Failed, or Terminated.

  Exit codes:
    0 - orchestrator Completed
    1 - orchestrator Failed/Terminated, HTTP error, timeout, or bad input

.PARAMETER CaseId
  case_id from test-cases.json. Default: case-001-acs.

.PARAMETER BaseUrl
  Base URL of the Functions host. Default: http://localhost:7071.

.PARAMETER TimeoutSeconds
  Total time to wait for terminal status. Default: 120.

.EXAMPLE
  pwsh scripts/smoke-test.ps1
  pwsh scripts/smoke-test.ps1 -CaseId case-004-dka
  pwsh scripts/smoke-test.ps1 -BaseUrl https://consilium-dev-eus-func-abc123.azurewebsites.net -TimeoutSeconds 300
#>
[CmdletBinding()]
param(
  [string] $CaseId = 'case-001-acs',
  [string] $BaseUrl = 'http://localhost:7071',
  [int] $TimeoutSeconds = 120
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
if (-not (Test-Path $settingsPath)) { Write-Fail "functions/local.settings.json not found. Copy local.settings.json.example and fill in CONSILIUM_API_KEY." }

$apiKey = (Get-Content $settingsPath -Raw | ConvertFrom-Json).Values.CONSILIUM_API_KEY
if (-not $apiKey -or $apiKey -eq 'local-dev-shared-secret-change-me') {
  Write-Fail "CONSILIUM_API_KEY in functions/local.settings.json is empty or still the placeholder."
}

$cases = (Get-Content $casesPath -Raw | ConvertFrom-Json).cases
$case  = $cases | Where-Object { $_.case_id -eq $CaseId } | Select-Object -First 1
if (-not $case) {
  Write-Host "Case '$CaseId' not found. Available case_ids:" -ForegroundColor Red
  $cases.case_id | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  exit 1
}

$expected = $case.expected_diagnosis
Write-Host "[smoke] Submitting '$CaseId' ($($case.complexity), expected: $expected)" -ForegroundColor Cyan

$body    = $case.input | ConvertTo-Json -Depth 10 -Compress
$headers = @{ 'x-api-key' = $apiKey; 'content-type' = 'application/json' }

$start = Get-Date
try {
  $startResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/cases" -Headers $headers -Body $body
} catch {
  $msg = $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    $msg = "$msg`n$($_.ErrorDetails.Message)"
  }
  Write-Fail "POST /api/cases failed: $msg"
}

$caseIdReturned = $startResponse.caseId
$instanceId     = $startResponse.instanceId
Write-Host "[smoke] caseId=$caseIdReturned instanceId=$instanceId" -ForegroundColor Cyan

$statusUrl  = "$BaseUrl/api/cases/$caseIdReturned/status?instanceId=$instanceId"
$deadline   = (Get-Date).AddSeconds($TimeoutSeconds)
$terminal   = @('Completed', 'Failed', 'Terminated')
$lastStatus = ''
$status     = $null

while ((Get-Date) -lt $deadline) {
  try {
    $status = Invoke-RestMethod -Method Get -Uri $statusUrl -Headers @{ 'x-api-key' = $apiKey }
  } catch {
    Write-Warning "status fetch failed: $($_.Exception.Message)"
    Start-Sleep -Seconds 2
    continue
  }

  if ($status.runtimeStatus -ne $lastStatus) {
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $count   = if ($status.traces) { $status.traces.Count } else { 0 }
    Write-Host ("[smoke] {0,6:N1}s  runtimeStatus={1}  traces={2}" -f $elapsed, $status.runtimeStatus, $count) -ForegroundColor DarkCyan
    $lastStatus = $status.runtimeStatus
  }

  if ($terminal -contains $status.runtimeStatus) { break }
  Start-Sleep -Seconds 2
}

if (-not $status -or -not ($terminal -contains $status.runtimeStatus)) {
  $finalState = if ($status) { $status.runtimeStatus } else { '(no response)' }
  Write-Fail "[smoke] Timed out after ${TimeoutSeconds}s. Last runtimeStatus: $finalState"
}

$totalSec = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
Write-Host ""
Write-Host "=== Final ($($status.runtimeStatus), ${totalSec}s) ===" -ForegroundColor Cyan
Write-Host ""

$traces = @($status.traces) | Sort-Object step
foreach ($t in $traces) {
  $tag = switch ($t.status) {
    'completed' { '[ok]' }
    'failed'    { '[!!]' }
    default     { '[..]' }
  }
  $dur = '-'
  if ($t.completedAt) {
    $dur = '{0:N1}s' -f (([datetime]$t.completedAt - [datetime]$t.startedAt).TotalSeconds)
  }
  $color = switch ($t.status) {
    'completed' { 'Green' }
    'failed'    { 'Red' }
    default     { 'Yellow' }
  }
  Write-Host "$tag step $($t.step) $($t.agent)  ($dur)" -ForegroundColor $color
  if ($t.error) {
    Write-Host "     error: $($t.error)" -ForegroundColor Red
  }
  if ($null -ne $t.output) {
    $json = $t.output | ConvertTo-Json -Depth 6
    $lines = $json -split "`n"
    $lines | Select-Object -First 20 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    if ($lines.Count -gt 20) {
      Write-Host "     ... ($($lines.Count - 20) more lines truncated)" -ForegroundColor DarkGray
    }
  }
}

Write-Host ""
if ($status.runtimeStatus -eq 'Completed') {
  Write-Host "[smoke] PASS" -ForegroundColor Green
  exit 0
} else {
  Write-Host "[smoke] FAIL - runtimeStatus=$($status.runtimeStatus)" -ForegroundColor Red
  exit 1
}
