#!/usr/bin/env bash
# CI test setup and runner.
# Starts a local CES server against a live Midnight network, runs tests, cleans up.
#
# Usage:
#   scripts/ci-test.sh <network_id>
#
# Prerequisites:
#   - bun installed
#   - Packages built
#
# Required environment:
#   CES_WALLET_MNEMONIC or CES_WALLET_SEED — CES server wallet credentials (mnemonic or hex seed)
#   REGISTRY_WALLET_MNEMONIC               — funded wallet for the registry flow (NIGHT + DUST)
#   COUNTER_ADDRESS                        — deployed counter contract address
#   TOKEN_MINT_ADDRESS                     — deployed token-mint contract address
#   DERIVED_TOKEN_COLOR                    — derived token color from token-mint deployment

set -euo pipefail

NETWORK_ID="${1:?Usage: ci-test.sh <network_id>}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CES_SERVER_PID=""
CES_PORT=3000
CES_READINESS_RETRIES=300
QUOTE_TTL_SECONDS=300
OFFER_TTL_SECONDS=60
WALLET_SYNC_TIMEOUT_MS=600000  # 10 minutes — first run syncs from genesis

CES_SERVER_MNEMONIC_FILE="$ROOT_DIR/apps/server/wallet-mnemonic.ci.txt"
CES_SERVER_SEED_FILE="$ROOT_DIR/apps/server/wallet-seed.ci.hex"
CES_SERVER_PRICE_CONFIG="$ROOT_DIR/apps/server/price-config.ci.json"
CES_SERVER_QUOTE_SECRET="$ROOT_DIR/apps/server/.quote-secret.ci.key"

CACHED_WALLET_STATE_DIR="$ROOT_DIR/.wallet-states"
TEMP_WALLET_STATE_DIR=""
CHAIN_SNAPSHOT_DIR="$ROOT_DIR/.chain-snapshots"

log() { echo "=== [ci-test] $*"; }

cleanup() {
  if [ -n "$CES_SERVER_PID" ]; then
    log "Stopping CES server (PID: $CES_SERVER_PID)"
    kill "$CES_SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$CES_SERVER_MNEMONIC_FILE"
  rm -f "$CES_SERVER_SEED_FILE"
  rm -f "$CES_SERVER_QUOTE_SECRET"
  rm -f "$CES_SERVER_PRICE_CONFIG"
  if [ -n "$TEMP_WALLET_STATE_DIR" ]; then
    rm -rf "$TEMP_WALLET_STATE_DIR"
  fi
}

validate_env() {
  if [ -z "${CES_WALLET_MNEMONIC:-}" ] && [ -z "${CES_WALLET_SEED:-}" ]; then
    log "ERROR: Set either CES_WALLET_MNEMONIC or CES_WALLET_SEED"
    exit 1
  fi
  for var in REGISTRY_WALLET_MNEMONIC COUNTER_ADDRESS TOKEN_MINT_ADDRESS DERIVED_TOKEN_COLOR; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: $var is not set"
      exit 1
    fi
  done
}

generate_runner_wallet() {
  log "Generating temp test runner wallet"
  RUNNER_MNEMONIC=$(bun -e "import { generateMnemonic } from '$ROOT_DIR/packages/midnight-core/src/seed.ts'; console.log(generateMnemonic());")
  TEMP_WALLET_STATE_DIR=$(mktemp -d)
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
  log "Starting CES server against $NETWORK_ID"
  local old_umask
  old_umask="$(umask)"
  umask 077
  openssl rand -hex 32 > "$CES_SERVER_QUOTE_SECRET"

  local wallet_env_var
  if [ -n "${CES_WALLET_SEED:-}" ]; then
    echo "$CES_WALLET_SEED" > "$CES_SERVER_SEED_FILE"
    wallet_env_var="WALLET_SEED_FILE=$CES_SERVER_SEED_FILE"
  else
    echo "$CES_WALLET_MNEMONIC" > "$CES_SERVER_MNEMONIC_FILE"
    wallet_env_var="WALLET_MNEMONIC_FILE=$CES_SERVER_MNEMONIC_FILE"
  fi
  umask "$old_umask"

  env \
    "$wallet_env_var" \
    MIDNIGHT_NETWORK="$NETWORK_ID" \
    QUOTE_SECRET_FILE="$CES_SERVER_QUOTE_SECRET" \
    PRICE_CONFIG_FILE="$CES_SERVER_PRICE_CONFIG" \
    QUOTE_TTL_SECONDS="$QUOTE_TTL_SECONDS" \
    OFFER_TTL_SECONDS="$OFFER_TTL_SECONDS" \
    WALLET_STATE_DIR="$CACHED_WALLET_STATE_DIR" \
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

seed_temp_wallet_state() {
  log "Seeding temp wallet state from cached chain snapshot"
  bun packages/midnight-node/src/cli/restore-from-chain-snapshot.ts "$NETWORK_ID" "$TEMP_WALLET_STATE_DIR" "$CHAIN_SNAPSHOT_DIR"
}

export_chain_snapshot() {
  log "Exporting updated chain snapshot for next run"
  bun packages/midnight-node/src/cli/export-chain-snapshot.ts "$NETWORK_ID" "$TEMP_WALLET_STATE_DIR" "$CHAIN_SNAPSHOT_DIR"
}

run_tests() {
  log "Running tests against $NETWORK_ID"

  # Sponsor + exchange use a fresh-per-run wallet (needs 0 DUST to exercise buying DUST).
  # Registry uses a funded, long-lived wallet (needs NIGHT for collateral + DUST for tx fees).
  env \
    NETWORK_ID="$NETWORK_ID" \
    SPONSOR_WALLET_MNEMONIC="$RUNNER_MNEMONIC" \
    EXCHANGE_WALLET_MNEMONIC="$RUNNER_MNEMONIC" \
    REGISTRY_WALLET_MNEMONIC="$REGISTRY_WALLET_MNEMONIC" \
    TEMP_WALLET_STATE_DIR="$TEMP_WALLET_STATE_DIR" \
    CACHED_WALLET_STATE_DIR="$CACHED_WALLET_STATE_DIR" \
    CHAIN_SNAPSHOT_DIR="$CHAIN_SNAPSHOT_DIR" \
    CES_URL=http://localhost:${CES_PORT} \
    COUNTER_ADDRESS="$COUNTER_ADDRESS" \
    TOKEN_MINT_ADDRESS="$TOKEN_MINT_ADDRESS" \
    DERIVED_TOKEN_COLOR="$DERIVED_TOKEN_COLOR" \
    WALLET_SYNC_TIMEOUT_MS="$WALLET_SYNC_TIMEOUT_MS" \
    bun apps/tests/src/runner.ts

  log "Tests passed"
}

trap cleanup EXIT
cd "$ROOT_DIR"

validate_env
generate_runner_wallet
generate_price_config
start_ces_server
wait_for_ces_server
seed_temp_wallet_state
run_tests
