#!/usr/bin/env bash
# Fallback smoke test.
# Starts 2 local CES servers via run-servers.sh (Server 1: no-dust, Server 2: funded),
# then runs a sponsor flow against Server 1 to verify peer DUST fallback.
#
# Usage:
#   scripts/ci-fallback-test.sh <network_id>
#
# Prerequisites:
#   - bun installed
#   - Packages built
#
# Required environment:
#   CES_WALLET_MNEMONIC_NO_DUST_PREVIEW or CES_WALLET_SEED_NO_DUST_PREVIEW  — no-dust wallet for Server 1
#   CES_WALLET2_MNEMONIC or CES_WALLET2_SEED  — funded wallet (DUST) for Server 2
#   TOKEN_MINT_ADDRESS                                  — deployed token-mint contract address
#   DERIVED_TOKEN_COLOR                                 — token color (for price config generation)

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

log() { echo "=== [ci-fallback-test] $*"; }

cleanup() {
  if [ -n "$RUN_SERVERS_PID" ]; then
    log "Stopping servers (PID: $RUN_SERVERS_PID)"
    kill "$RUN_SERVERS_PID" 2>/dev/null || true
  fi
}

validate_env() {
  if [ -z "${CES_WALLET_MNEMONIC_NO_DUST_PREVIEW:-}" ] && [ -z "${CES_WALLET_SEED_NO_DUST_PREVIEW:-}" ]; then
    log "ERROR: Set either CES_WALLET_MNEMONIC_NO_DUST_PREVIEW or CES_WALLET_SEED_NO_DUST_PREVIEW"
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

trap cleanup EXIT
cd "$ROOT_DIR"

validate_env
log "Generating ephemeral runner wallet for sponsor flow"
RUNNER_MNEMONIC=$(generate_runner_wallet "$ROOT_DIR")
start_servers
wait_for_server "$SERVER1_PORT" "Server 1" RUN_SERVERS_PID "$SERVER_READINESS_RETRIES"
wait_for_server "$SERVER2_PORT" "Server 2" RUN_SERVERS_PID "$SERVER_READINESS_RETRIES"
run_fallback_test
