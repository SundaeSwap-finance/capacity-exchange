#!/usr/bin/env bash
# Fallback smoke test.
# Starts 2 local CES servers via run-servers.sh (Server 1: no-dust, Server 2: funded),
# then runs a sponsor flow against Server 1 to verify peer DUST fallback.
#
# Runs two rounds when both wallet env vars are provided:
#   Round 1 (shielded):   Server 1 holds shielded tokens → pays Server 2 with shielded tokens
#   Round 2 (unshielded): Server 1 holds unshielded tokens → pays Server 2 with unshielded tokens
#
# Usage:
#   scripts/ci-fallback-test.sh <network_id>
#
# Prerequisites:
#   - bun installed
#   - Packages built
#
# Required environment:
#   CES_WALLET_MNEMONIC_NO_DUST or CES_WALLET_SEED_NO_DUST_PREVIEW              — Server 1 wallet (shielded tokens, no DUST)
#   CES_WALLET_MNEMONIC_NO_DUST_UNSHIELDED or ..._SEED (optional)               — Server 1 wallet (unshielded tokens, no DUST); enables round 2
#   CES_WALLET2_MNEMONIC or CES_WALLET2_SEED                                             — funded wallet (DUST) for Server 2
#   TOKEN_MINT_ADDRESS                                  — deployed token-mint contract address
#   DERIVED_TOKEN_COLOR                                 — shielded token color (for price config generation)
#   UNSHIELDED_TOKEN_COLOR                              — unshielded token color (for price config generation)

set -euo pipefail
# shellcheck source=lib/utils.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/utils.sh"

NETWORK_ID="${1:?Usage: ci-fallback-test.sh <network_id>}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_SERVERS_PID=""
# These must match run-servers.sh BASE_PORT (default 3000).
SERVER1_PORT=3000
SERVER2_PORT=3001
SERVER_READINESS_RETRIES=900
WALLET_SYNC_TIMEOUT_MS=1500000  # 25 minutes — first run syncs from genesis

CHAIN_SNAPSHOT_DIR="$ROOT_DIR/.chain-snapshots"
NO_DUST_PRICE_CONFIG="$ROOT_DIR/apps/server/price-config.$NETWORK_ID.no-dust.json"

log() { echo "=== [ci-fallback-test] $*"; }

#  only called when the tests fail.
print_server_logs() {
  log "Server 1 logs:"; cat "$ROOT_DIR/server1.log" 2>/dev/null || true
  log "Server 2 logs:"; cat "$ROOT_DIR/server2.log" 2>/dev/null || true
}

stop_servers() {
  if [ -n "$RUN_SERVERS_PID" ]; then
    log "Stopping servers (PID: $RUN_SERVERS_PID)"
    kill "$RUN_SERVERS_PID" 2>/dev/null || true
    wait "$RUN_SERVERS_PID" 2>/dev/null || true
    RUN_SERVERS_PID=""
  fi
  # Remove generated no-dust price config so next round regenerates it
  rm -f "$NO_DUST_PRICE_CONFIG"
}

cleanup() {
  local exit_code=$?
  [ $exit_code -ne 0 ] && print_server_logs
  stop_servers
}

validate_env() {
  if [ -z "${CES_WALLET_MNEMONIC_NO_DUST:-}" ] && [ -z "${CES_WALLET_SEED_NO_DUST_PREVIEW:-}" ]; then
    log "ERROR: Set either CES_WALLET_MNEMONIC_NO_DUST or CES_WALLET_SEED_NO_DUST_PREVIEW"
    exit 1
  fi
  if [ -z "${CES_WALLET2_MNEMONIC:-}" ] && [ -z "${CES_WALLET2_SEED:-}" ]; then
    log "ERROR: Set either CES_WALLET2_MNEMONIC or CES_WALLET2_SEED"
    exit 1
  fi
  if [ -z "${TOKEN_MINT_ADDRESS:-}" ]; then
    log "ERROR: TOKEN_MINT_ADDRESS is not set"
    exit 1
  fi
  if [ -z "${DERIVED_TOKEN_COLOR:-}" ]; then
    log "ERROR: DERIVED_TOKEN_COLOR is not set"
    exit 1
  fi
  if [ -z "${UNSHIELDED_TOKEN_COLOR:-}" ]; then
    log "ERROR: UNSHIELDED_TOKEN_COLOR is not set"
    exit 1
  fi
}

start_servers() {
  log "Starting CES servers (N=2) against $NETWORK_ID"
  MIDNIGHT_NETWORK="$NETWORK_ID" \
  SKIP_BALANCE_CHECK=1 \
    bash "$ROOT_DIR/scripts/run-servers.sh" 2 &
  RUN_SERVERS_PID=$!
  log "run-servers.sh started (PID: $RUN_SERVERS_PID)"
}

run_fallback_test() {
  log "Running sponsor-fallback flow against Server 1 (no-dust, port $SERVER1_PORT)"
  env \
    NETWORK_ID="$NETWORK_ID" \
    SPONSOR_WALLET_MNEMONIC="$RUNNER_MNEMONIC" \
    TOKEN_MINT_ADDRESS="$TOKEN_MINT_ADDRESS" \
    CHAIN_SNAPSHOT_DIR="$CHAIN_SNAPSHOT_DIR" \
    NO_DUST_CES_URL="http://localhost:${SERVER1_PORT}" \
    WALLET_SYNC_TIMEOUT_MS="$WALLET_SYNC_TIMEOUT_MS" \
    bun apps/tests/src/fallback-runner.ts
  log "Sponsor-fallback flow passed"
}

run_round() {
  local label="$1"
  log "=== Fallback round: $label ==="
  start_servers
  wait_for_server "$SERVER1_PORT" "Server 1" RUN_SERVERS_PID "$SERVER_READINESS_RETRIES"
  wait_for_server "$SERVER2_PORT" "Server 2" RUN_SERVERS_PID "$SERVER_READINESS_RETRIES"
  run_fallback_test
  stop_servers
}

trap cleanup EXIT
cd "$ROOT_DIR"

validate_env
log "Generating ephemeral runner wallet for sponsor flow"
RUNNER_MNEMONIC=$(generate_runner_wallet "$ROOT_DIR")

run_round "shielded"

if [ -n "${CES_WALLET_MNEMONIC_NO_DUST_UNSHIELDED:-}" ] || [ -n "${CES_WALLET_SEED_NO_DUST_UNSHIELDED_PREVIEW:-}" ]; then
  # replacing CES_WALLET_MNEMONIC_NO_DUST with the unshielded wallet for the second round
  export CES_WALLET_MNEMONIC_NO_DUST="${CES_WALLET_MNEMONIC_NO_DUST_UNSHIELDED:-}"
  export CES_WALLET_SEED_NO_DUST_PREVIEW="${CES_WALLET_SEED_NO_DUST_UNSHIELDED_PREVIEW:-}"
  run_round "unshielded"
fi