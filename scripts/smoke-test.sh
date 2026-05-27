#!/usr/bin/env bash
# Submit one Consilium test case and poll until terminal status.
#
# Usage:
#   ./smoke-test.sh [case-id] [--base-url URL] [--timeout SECONDS]
#
# Exit 0 on Completed; 1 on Failed, Terminated, HTTP error, timeout, or bad input.
#
# Requires: jq, curl, bash 4+

set -eu

CASE_ID="${1:-case-001-acs}"
BASE_URL="http://localhost:7071"
TIMEOUT_SECONDS=120

# Strip the positional arg if provided so the flag loop sees only flags.
if [[ $# -gt 0 && "$1" != --* ]]; then
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --timeout)  TIMEOUT_SECONDS="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CASES_PATH="$SCRIPT_DIR/test-cases.json"
SETTINGS_PATH="$REPO_ROOT/functions/local.settings.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install: https://stedolan.github.io/jq/" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if [[ ! -f "$CASES_PATH" ]]; then
  echo "test-cases.json not found at $CASES_PATH" >&2
  exit 1
fi
if [[ ! -f "$SETTINGS_PATH" ]]; then
  echo "functions/local.settings.json not found." >&2
  exit 1
fi

API_KEY="$(jq -r '.Values.CONSILIUM_API_KEY // empty' "$SETTINGS_PATH")"
if [[ -z "$API_KEY" || "$API_KEY" == "local-dev-shared-secret-change-me" ]]; then
  echo "CONSILIUM_API_KEY missing or still placeholder in functions/local.settings.json" >&2
  exit 1
fi

BODY="$(jq -c --arg id "$CASE_ID" '.cases[] | select(.case_id == $id) | .input' "$CASES_PATH")"
if [[ -z "$BODY" ]]; then
  echo "Case '$CASE_ID' not found. Available case_ids:" >&2
  jq -r '.cases[].case_id' "$CASES_PATH" >&2
  exit 1
fi

EXPECTED="$(jq -r --arg id "$CASE_ID" '.cases[] | select(.case_id == $id) | .expected_diagnosis' "$CASES_PATH")"
COMPLEXITY="$(jq -r --arg id "$CASE_ID" '.cases[] | select(.case_id == $id) | .complexity' "$CASES_PATH")"
echo "[smoke] Submitting '$CASE_ID' (${COMPLEXITY}, expected: ${EXPECTED})"

START_TIME=$(date +%s)
START_RESPONSE="$(curl -sS -X POST "$BASE_URL/api/cases" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d "$BODY")" || { echo "[smoke] POST failed" >&2; exit 1; }

CASE_ID_RET="$(echo "$START_RESPONSE" | jq -r '.caseId // empty')"
INSTANCE_ID="$(echo "$START_RESPONSE" | jq -r '.instanceId // empty')"
if [[ -z "$CASE_ID_RET" || -z "$INSTANCE_ID" ]]; then
  echo "[smoke] Submit failed:" >&2
  echo "$START_RESPONSE" >&2
  exit 1
fi
echo "[smoke] caseId=$CASE_ID_RET instanceId=$INSTANCE_ID"

STATUS_URL="$BASE_URL/api/cases/$CASE_ID_RET/status?instanceId=$INSTANCE_ID"
DEADLINE=$((START_TIME + TIMEOUT_SECONDS))
LAST_STATUS=""
STATUS_JSON=""
CURRENT="Pending"

while [[ $(date +%s) -lt $DEADLINE ]]; do
  STATUS_JSON="$(curl -sS "$STATUS_URL" -H "x-api-key: $API_KEY")" || { sleep 2; continue; }
  CURRENT="$(echo "$STATUS_JSON" | jq -r '.runtimeStatus // "Unknown"')"

  if [[ "$CURRENT" != "$LAST_STATUS" ]]; then
    ELAPSED=$(( $(date +%s) - START_TIME ))
    COUNT="$(echo "$STATUS_JSON" | jq -r '.traces | length')"
    printf '[smoke] %6ds  runtimeStatus=%s  traces=%s\n' "$ELAPSED" "$CURRENT" "$COUNT"
    LAST_STATUS="$CURRENT"
  fi

  case "$CURRENT" in
    Completed|Failed|Terminated) break ;;
  esac
  sleep 2
done

TOTAL=$(( $(date +%s) - START_TIME ))
echo ""
echo "=== Final ($CURRENT, ${TOTAL}s) ==="
echo ""

# Per-agent summary line + truncated output preview.
echo "$STATUS_JSON" | jq -r '
  .traces
  | sort_by(.step)
  | .[]
  | "\(if .status == "completed" then "[ok]" elif .status == "failed" then "[!!]" else "[..]" end) step \(.step) \(.agent)"
'

echo ""
if [[ "$CURRENT" == "Completed" ]]; then
  echo "[smoke] PASS"
  exit 0
else
  echo "[smoke] FAIL - runtimeStatus=$CURRENT"
  exit 1
fi
