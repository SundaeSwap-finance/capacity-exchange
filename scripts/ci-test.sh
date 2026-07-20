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
#   CES_WALLET_MNEMONIC or CES_WALLET_SEED                        — CES server wallet credentials (mnemonic or hex seed)
#   REGISTRY_WALLET_MNEMONIC or REGISTRY_WALLET_SEED              — funded wallet for the registry flow (NIGHT + DUST)
#   UNSHIELDED_EXCHANGE_WALLET_MNEMONIC or ..._SEED               — wallet with unshielded tokens (no DUST)
#   COUNTER_ADDRESS                                               — deployed counter contract address
#   TOKEN_MINT_ADDRESS                                            — deployed token-mint contract address
#   DERIVED_TOKEN_COLOR                                           — derived token color from token-mint deployment
#   UNSHIELDED_TOKEN_COLOR                                        — unshielded token rawId for the unshielded exchange flow

set -euo pipefail
# shellcheck source=lib/utils.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/utils.sh"

NETWORK_ID="${1:?Usage: ci-test.sh <network_id>}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CES_SERVER_PID=""
CES_PORT=3000
CES_READINESS_RETRIES=900
QUOTE_TTL_SECONDS=300
OFFER_TTL_SECONDS=60
WALLET_SYNC_TIMEOUT_MS=1500000  # 25 minutes — first run syncs from genesis

CES_SERVER_MNEMONIC_FILE="$ROOT_DIR/apps/server/wallet-mnemonic.ci.txt"
CES_SERVER_SEED_FILE="$ROOT_DIR/apps/server/wallet-seed.ci.hex"
CES_SERVER_PRICE_CONFIG="$ROOT_DIR/apps/server/price-config.ci.json"
CES_SERVER_QUOTE_SECRET="$ROOT_DIR/apps/server/.quote-secret.ci.key"

CACHED_WALLET_STATE_DIR="$ROOT_DIR/.wallet-states"
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
}

validate_env() {
  if [ -z "${CES_WALLET_MNEMONIC:-}" ] && [ -z "${CES_WALLET_SEED:-}" ]; then
    log "ERROR: Set either CES_WALLET_MNEMONIC or CES_WALLET_SEED"
    exit 1
  fi
  if [ -z "${REGISTRY_WALLET_MNEMONIC:-}" ] && [ -z "${REGISTRY_WALLET_SEED:-}" ]; then
    log "ERROR: Set either REGISTRY_WALLET_MNEMONIC or REGISTRY_WALLET_SEED"
    exit 1
  fi
  for var in COUNTER_ADDRESS TOKEN_MINT_ADDRESS DERIVED_TOKEN_COLOR UNSHIELDED_TOKEN_COLOR; do
    if [ -z "${!var:-}" ]; then
      log "ERROR: $var is not set"
      exit 1
    fi
  done
}

generate_price_config() {
  log "Generating price config for CES server"
  bun "$ROOT_DIR/scripts/gen-price-config.ts" "$CES_SERVER_PRICE_CONFIG" "$DERIVED_TOKEN_COLOR" "$TOKEN_MINT_ADDRESS" \
    --unshielded-token-color "$UNSHIELDED_TOKEN_COLOR"
}

start_ces_server() {
  log "Starting CES server against $NETWORK_ID"
  generate_quote_secret "$CES_SERVER_QUOTE_SECRET"

  local wallet_env_var
  if [ -n "${CES_WALLET_SEED:-}" ]; then
    write_secret_file "$CES_WALLET_SEED" "$CES_SERVER_SEED_FILE"
    wallet_env_var="WALLET_SEED_FILE=$CES_SERVER_SEED_FILE"
  else
    write_secret_file "$CES_WALLET_MNEMONIC" "$CES_SERVER_MNEMONIC_FILE"
    wallet_env_var="WALLET_MNEMONIC_FILE=$CES_SERVER_MNEMONIC_FILE"
  fi

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

run_tests() {
  log "Running tests against $NETWORK_ID"

  # Sponsor + exchange use a fresh-per-run ephemeral wallet (needs 0 DUST to exercise buying DUST).
  # Registry uses a funded, long-lived persistent wallet (needs NIGHT for collateral + DUST for tx fees).
  # CES_SERVER_WALLET mirrors the CES server wallet so the exchange flow can verify server-side balances.
  env \
    NETWORK_ID="$NETWORK_ID" \
    SPONSOR_WALLET_MNEMONIC="$RUNNER_MNEMONIC" \
    EXCHANGE_WALLET_MNEMONIC="$RUNNER_MNEMONIC" \
    CES_SERVER_WALLET_MNEMONIC="${CES_WALLET_MNEMONIC:-}" \
    CES_SERVER_WALLET_SEED="${CES_WALLET_SEED:-}" \
    REGISTRY_WALLET_MNEMONIC="${REGISTRY_WALLET_MNEMONIC:-}" \
    REGISTRY_WALLET_SEED="${REGISTRY_WALLET_SEED:-}" \
    CACHED_WALLET_STATE_DIR="$CACHED_WALLET_STATE_DIR" \
    CHAIN_SNAPSHOT_DIR="$CHAIN_SNAPSHOT_DIR" \
    CES_URL=http://localhost:${CES_PORT} \
    COUNTER_ADDRESS="$COUNTER_ADDRESS" \
    TOKEN_MINT_ADDRESS="$TOKEN_MINT_ADDRESS" \
    DERIVED_TOKEN_COLOR="$DERIVED_TOKEN_COLOR" \
    WALLET_SYNC_TIMEOUT_MS="$WALLET_SYNC_TIMEOUT_MS" \
    bun apps/tests/src/runner.ts

  log "Shielded exchange flow passed"
}

run_unshielded_test() {
  if [ -z "${UNSHIELDED_EXCHANGE_WALLET_MNEMONIC:-}" ] && [ -z "${UNSHIELDED_EXCHANGE_WALLET_SEED:-}" ]; then
    log "Skipping unshielded exchange test; no wallet configured"
    exit 0
  fi
  log "Running unshielded exchange flow against $NETWORK_ID"
  env \
    NETWORK_ID="$NETWORK_ID" \
    EXCHANGE_WALLET_MNEMONIC="${UNSHIELDED_EXCHANGE_WALLET_MNEMONIC:-}" \
    EXCHANGE_WALLET_SEED="${UNSHIELDED_EXCHANGE_WALLET_SEED:-}" \
    CES_SERVER_WALLET_MNEMONIC="${CES_WALLET_MNEMONIC:-}" \
    CES_SERVER_WALLET_SEED="${CES_WALLET_SEED:-}" \
    COUNTER_ADDRESS="$COUNTER_ADDRESS" \
    UNSHIELDED_TOKEN_COLOR="$UNSHIELDED_TOKEN_COLOR" \
    CHAIN_SNAPSHOT_DIR="$CHAIN_SNAPSHOT_DIR" \
    CES_URL=http://localhost:${CES_PORT} \
    WALLET_SYNC_TIMEOUT_MS="$WALLET_SYNC_TIMEOUT_MS" \
    bun apps/tests/src/unshielded-runner.ts
  log "Unshielded exchange flow passed"
}

trap cleanup EXIT
cd "$ROOT_DIR"

validate_env
log "Generating ephemeral runner wallet for sponsor+exchange flows"
RUNNER_MNEMONIC=$(generate_runner_wallet "$ROOT_DIR")
generate_price_config
start_ces_server
wait_for_server "$CES_PORT" "CES server" CES_SERVER_PID "$CES_READINESS_RETRIES"
run_tests
run_unshielded_test
