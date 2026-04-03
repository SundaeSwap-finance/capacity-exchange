#!/usr/bin/env bash
# Usage: test-prove-and-sponsor.sh [N]
#
# 1. Starts N CES servers via run-servers.sh and waits for them to be ready,
# 2. Runs the prove-and-sponsor integration test against server 1,
# 3. Check the test result if `sponsorResponse` json HAS a tx field present,
# 4. If success, prints the length of the tx using the bytes field,
# 5. If failure, prints the error,
# 6. Cleans up the servers before exiting.
#
# Override defaults with env vars:
#   MIDNIGHT_NETWORK    (default: preview)
#   BASE_PORT           (default: 3000)
#   SERVER_URL          (default: http://localhost:BASE_PORT)
#   READY_TIMEOUT_SECS  (default: 120)  – seconds to wait for each server to become ready
#   SKIP_BALANCE_CHECK  (default: 0)    – pass through to run-servers.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$(cd "$SERVER_DIR/../example-webapp/contracts" && pwd)"

N="${1:-2}"
MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-preview}"
BASE_PORT="${BASE_PORT:-3000}"
SERVER_URL="${SERVER_URL:-http://localhost:$BASE_PORT}"
READY_TIMEOUT_SECS="${READY_TIMEOUT_SECS:-120}"

# ── Resolve contract address ──────────────────────────────────────────────────
CONTRACTS_FILE="$CONTRACTS_DIR/.contracts.${MIDNIGHT_NETWORK}.json"
if [ ! -f "$CONTRACTS_FILE" ]; then
  echo "Error: Contracts file not found at $CONTRACTS_FILE"
  echo "Deploy the contracts first (task deploy or bun src/deploy-all.ts)"
  exit 1
fi
CONTRACT_ADDRESS=$(bun -e "
  const d = JSON.parse(require('fs').readFileSync('$CONTRACTS_FILE', 'utf-8'));
  process.stdout.write(d.counter.contractAddress);
")
echo "Counter contract address: $CONTRACT_ADDRESS"

# ── Start servers ─────────────────────────────────────────────────────────────
echo ""
echo "Starting $N servers..."
SERVERS_PID=""

cleanup() {
  echo ""
  echo "Stopping servers..."
  [ -n "$SERVERS_PID" ] && kill "$SERVERS_PID" 2>/dev/null && wait "$SERVERS_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

SKIP_BALANCE_CHECK="${SKIP_BALANCE_CHECK:-0}" \
  bash "$SCRIPT_DIR/run-servers.sh" "$N" &
SERVERS_PID=$!

# ── Wait for server 1 to be ready ────────────────────────────────────────────
echo ""
echo "Waiting for server 1 at $SERVER_URL to be ready (timeout: ${READY_TIMEOUT_SECS}s)..."
ELAPSED=0
until curl -sf "$SERVER_URL/health/ready" -o /dev/null 2>/dev/null; do
  if [ "$ELAPSED" -ge "$READY_TIMEOUT_SECS" ]; then
    echo "Error: Server 1 did not become ready within ${READY_TIMEOUT_SECS}s"
    exit 1
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo "  Still waiting... (${ELAPSED}s)"
done
echo "Server 1 is ready."

# ── Run the test ──────────────────────────────────────────────────────────────
echo ""
echo "Running prove-and-sponsor test against $SERVER_URL..."
echo "  Contract: $CONTRACT_ADDRESS"
echo "  Network:  $MIDNIGHT_NETWORK"
echo ""

cd "$CONTRACTS_DIR"
OUTPUT=$(bun src/counter/cli/test/prove-and-sponsor.ts \
    "$MIDNIGHT_NETWORK" \
    "$CONTRACT_ADDRESS" \
    --server-url "$SERVER_URL")
EXIT_CODE=$?

echo "$OUTPUT"

if [ "$EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "✗ prove-and-sponsor test failed (non-zero exit)"
  exit 1
fi

SPONSOR_TX=$(echo "$OUTPUT" | jq -r '.sponsorResponse.tx // empty' 2>/dev/null)
if [ -z "$SPONSOR_TX" ]; then
  echo ""
  echo "✗ prove-and-sponsor test failed: sponsor response does not contain a 'tx' field"
  echo "  Response: $(echo "$OUTPUT" | jq '.sponsorResponse' 2>/dev/null || echo "$OUTPUT")"
  exit 1
fi

echo ""
echo "✓ prove-and-sponsor test passed (sponsor tx: ${#SPONSOR_TX} hex chars)"
exit 0