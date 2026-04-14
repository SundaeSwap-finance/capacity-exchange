#!/usr/bin/env bash
# CI integration test setup and runner.
# Starts a local CES server against preview infrastructure,
# generates a fresh runner wallet, runs integration tests, cleans up.
#
# Prerequisites:
#   - bun installed
#   - Packages built
#
# Required environment:
#   CES_WALLET_MNEMONIC — BIP-39 mnemonic for a funded preview wallet
#   COUNTER_ADDRESS     — deployed counter contract address on preview
#   TOKEN_MINT_ADDRESS  — deployed token-mint contract address on preview
#   DERIVED_TOKEN_COLOR — derived token color from token-mint deployment

set -euo pipefail

NETWORK_ID="preview"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CES_SERVER_PID=""
CES_PORT=3000
CES_READINESS_RETRIES=300
QUOTE_TTL_SECONDS=300
OFFER_TTL_SECONDS=60
WALLET_SYNC_TIMEOUT_MS=600000  # 10 minutes — first run syncs from genesis

CES_SERVER_MNEMONIC_FILE="$ROOT_DIR/apps/server/wallet-mnemonic.ci.txt"
CES_SERVER_PRICE_CONFIG="$ROOT_DIR/apps/server/price-config.ci.json"
CES_SERVER_WALLET_STATE="$ROOT_DIR/apps/server/.wallet-state-ci"
CES_SERVER_QUOTE_SECRET="$ROOT_DIR/apps/server/.quote-secret.ci.key"
TEST_RUNNER_MNEMONIC_FILE="$ROOT_DIR/wallet-mnemonic.${NETWORK_ID}.txt"
TEST_RUNNER_WALLET_STATE="$ROOT_DIR/.wallet-state-${NETWORK_ID}"
CHAIN_SNAPSHOT_DIR="$ROOT_DIR/.chain-snapshots"

log() { echo "=== [ci-integ-setup] $*"; }

cleanup() {
  if [ -n "$CES_SERVER_PID" ]; then
    log "Stopping CES server (PID: $CES_SERVER_PID)"
    kill "$CES_SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$CES_SERVER_MNEMONIC_FILE"
  rm -f "$TEST_RUNNER_MNEMONIC_FILE"
  rm -f "$CES_SERVER_QUOTE_SECRET"
}

validate_env() {
  for var in CES_WALLET_MNEMONIC COUNTER_ADDRESS TOKEN_MINT_ADDRESS DERIVED_TOKEN_COLOR; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: $var is not set"
      exit 1
    fi
  done
}

generate_runner_wallet() {
  log "Generating ephemeral test runner wallet"
  RUNNER_MNEMONIC=$(bun -e "import { generateMnemonic } from '$ROOT_DIR/packages/midnight-core/src/seed.ts'; console.log(generateMnemonic());")
}

generate_price_config() {
  log "Generating price config for CES server"
  cat > "$CES_SERVER_PRICE_CONFIG" <<EOF
{
  "priceFormulas": [
    {
      "currency": {
        "type": "midnight:shielded",
        "rawId": "$DERIVED_TOKEN_COLOR"
      },
      "basePrice": "101",
      "rateNumerator": "11",
      "rateDenominator": "1000"
    }
  ],
  "sponsorAll": false,
  "sponsoredContracts": [
    {
      "contractAddress": "$TOKEN_MINT_ADDRESS",
      "circuits": { "type": "all" }
    }
  ]
}
EOF
}

start_ces_server() {
  log "Starting CES server"
  echo "$CES_WALLET_MNEMONIC" > "$CES_SERVER_MNEMONIC_FILE"
  openssl rand -hex 32 > "$CES_SERVER_QUOTE_SECRET"

  MIDNIGHT_NETWORK="$NETWORK_ID" \
  WALLET_MNEMONIC_FILE="$CES_SERVER_MNEMONIC_FILE" \
  QUOTE_SECRET_FILE="$CES_SERVER_QUOTE_SECRET" \
  PRICE_CONFIG_FILE="$CES_SERVER_PRICE_CONFIG" \
  QUOTE_TTL_SECONDS="$QUOTE_TTL_SECONDS" \
  OFFER_TTL_SECONDS="$OFFER_TTL_SECONDS" \
  WALLET_STATE_DIR="$CES_SERVER_WALLET_STATE" \
  LOG_LEVEL=info \
  PORT="$CES_PORT" \
  NODE_ENV=dev \
    bun apps/server/src/server.ts &

  CES_SERVER_PID=$!
  log "CES server started (PID: $CES_SERVER_PID)"
}

wait_for_ces_server() {
  log "Waiting for CES server to be ready"
  for i in $(seq 1 "$CES_READINESS_RETRIES"); do
    if curl -sf http://localhost:${CES_PORT}/health/ready > /dev/null 2>&1; then
      log "CES server is ready"
      return
    fi
    if ! kill -0 "$CES_SERVER_PID" 2>/dev/null; then
      log "ERROR: CES server exited unexpectedly"
      exit 1
    fi
    sleep 2
  done
  log "ERROR: CES server did not become ready in time"
  exit 1
}

seed_runner_wallet_state() {
  log "Seeding runner wallet state from cached chain snapshot"
  echo "$RUNNER_MNEMONIC" > "$TEST_RUNNER_MNEMONIC_FILE"
  bun packages/midnight-node/src/cli/seed-wallet-state.ts "$NETWORK_ID" "$TEST_RUNNER_WALLET_STATE" "$CHAIN_SNAPSHOT_DIR"
}

export_chain_snapshot() {
  log "Exporting updated chain snapshot for next run"
  bun packages/midnight-node/src/cli/export-chain-snapshot.ts "$NETWORK_ID" "$TEST_RUNNER_WALLET_STATE" "$CHAIN_SNAPSHOT_DIR"
}

run_integ_tests() {
  log "Running integration tests"

  NETWORK_ID="$NETWORK_ID" \
  CES_URL=http://localhost:${CES_PORT} \
  COUNTER_ADDRESS="$COUNTER_ADDRESS" \
  TOKEN_MINT_ADDRESS="$TOKEN_MINT_ADDRESS" \
  DERIVED_TOKEN_COLOR="$DERIVED_TOKEN_COLOR" \
  WALLET_SYNC_TIMEOUT_MS="$WALLET_SYNC_TIMEOUT_MS" \
    bun apps/integ-tests/src/runner.ts

  log "Integration tests passed"
}

trap cleanup EXIT
cd "$ROOT_DIR"

validate_env
generate_runner_wallet
generate_price_config
start_ces_server
wait_for_ces_server
seed_runner_wallet_state
run_integ_tests
export_chain_snapshot
