#!/usr/bin/env bash
# Starts N CES servers for local multi-server testing.
#
# Usage:
#   MIDNIGHT_NETWORK=preview scripts/run-servers.sh [N]
#
# N defaults to 2 (minimum).
#   - No-dust Server: no-dust wallet; peers to all funded servers (2..N)
#   - Servers 2..N: hold DUST and serve it directly.
#
# Servers 2..N share the same price config (price-config.<network>.json in apps/server/).
# If it doesn't exist, it is generated from DERIVED_TOKEN_COLOR + UNSHIELDED_TOKEN_COLOR + TOKEN_MINT_ADDRESS.
#
# Ports:
#   - Server i API:       BASE_PORT + i - 1           (default base: 3000)
#   - Server i dashboard: BASE_DASHBOARD_PORT + i - 1  (default base: 4000)
#
# Wallet env vars accept either a file path or a raw mnemonic/seed string.
# Raw strings are written to a temp file automatically.
#   - No-dust Server: CES_WALLET_MNEMONIC_NO_DUST_PREVIEW (default: wallet-mnemonic-no-dust.<network>.txt)
#               or CES_WALLET_SEED_NO_DUST_PREVIEW as fallback.
#   - Server i: CES_WALLET{i}_MNEMONIC or CES_WALLET{i}_SEED env var,
#               falling back to wallet-mnemonic-{i}.<network>.txt or wallet-seed-{i}.<network>.hex
#
# Required env vars (only if price config needs to be generated):
#   - DERIVED_TOKEN_COLOR
#   - UNSHIELDED_TOKEN_COLOR
#   - TOKEN_MINT_ADDRESS
#
# Optional env vars:
#   - BASE_PORT               API base port (default: 3000)
#   - BASE_DASHBOARD_PORT     Dashboard base port (default: 4000)
#   - MIDNIGHT_NETWORK        Network to connect to (default: preview)
#   - SKIP_BALANCE_CHECK      Set to 1 to bypass wallet balance checks (default: 0)
#   - CHAIN_SNAPSHOT_DIR      Path to chain snapshots (default: .chain-snapshots/ at repo root).
#   - LOG_DIR                 Directory for server log files (default: repo root).
#   - WALLET_STATE_DIR        Directory for wallet state (default: .wallet-states/ at repo root).

set -euo pipefail
# shellcheck source=lib/utils.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/utils.sh"

N=${1:-2}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$ROOT_DIR/apps/server"

BASE_PORT=${BASE_PORT:-3000}
BASE_DASHBOARD_PORT=${BASE_DASHBOARD_PORT:-4000}
MIDNIGHT_NETWORK=${MIDNIGHT_NETWORK:-preview}
SKIP_BALANCE_CHECK=${SKIP_BALANCE_CHECK:-0}
LOG_DIR=${LOG_DIR:-$ROOT_DIR}
WALLET_STATE_DIR="${WALLET_STATE_DIR:-$ROOT_DIR/.wallet-states}"
CHAIN_SNAPSHOT_DIR="${CHAIN_SNAPSHOT_DIR:-$ROOT_DIR/.chain-snapshots}"
CES_SERVER_PRICE_CONFIG="$PROJECT_ROOT/price-config.$MIDNIGHT_NETWORK.json"
CES_SERVER_NO_DUST_PRICE_CONFIG="$PROJECT_ROOT/price-config.$MIDNIGHT_NETWORK.no-dust.json"
QUOTE_TTL_SECONDS=${QUOTE_TTL_SECONDS:-300}
OFFER_TTL_SECONDS=${OFFER_TTL_SECONDS:-60}
LOG_LEVEL=${LOG_LEVEL:-info}

PIDS=()
CREATED_FILES=()  # files created by this run; only these are deleted on exit

CES_SERVER_NO_DUST_MNEMONIC_FILE="$ROOT_DIR/wallet-mnemonic-no-dust.$MIDNIGHT_NETWORK.ci.txt"
CES_SERVER_NO_DUST_SEED_FILE="$ROOT_DIR/wallet-seed-no-dust.$MIDNIGHT_NETWORK.ci.hex"

log() { echo "=== [run-servers] $*"; }

# If a wallet env var holds a raw string (not a file path), write it to a named
# file (mode 600) and update the var to the file path. Called once before any wallet reads.
write_wallet_files() {
  local old_umask
  old_umask="$(umask)"
  umask 077
  if [ -n "${CES_WALLET_MNEMONIC_NO_DUST_PREVIEW:-}" ] && [ ! -f "$CES_WALLET_MNEMONIC_NO_DUST_PREVIEW" ]; then
    printf '%s\n' "$CES_WALLET_MNEMONIC_NO_DUST_PREVIEW" > "$CES_SERVER_NO_DUST_MNEMONIC_FILE"
   
    # track CES_SERVER_NO_DUST_MNEMONIC_FILE file for cleanup
    CREATED_FILES+=("$CES_SERVER_NO_DUST_MNEMONIC_FILE")
    export CES_WALLET_MNEMONIC_NO_DUST_PREVIEW="$CES_SERVER_NO_DUST_MNEMONIC_FILE"
  elif [ -n "${CES_WALLET_SEED_NO_DUST_PREVIEW:-}" ] && [ ! -f "$CES_WALLET_SEED_NO_DUST_PREVIEW" ]; then
    printf '%s\n' "$CES_WALLET_SEED_NO_DUST_PREVIEW" > "$CES_SERVER_NO_DUST_SEED_FILE"
    
    # track CES_SERVER_NO_DUST_SEED_FILE file for cleanup
    CREATED_FILES+=("$CES_SERVER_NO_DUST_SEED_FILE")
    export CES_WALLET_SEED_NO_DUST_PREVIEW="$CES_SERVER_NO_DUST_SEED_FILE"
  fi
  for ((i=2; i<=N; i++)); do
    local mnemonic_var="CES_WALLET${i}_MNEMONIC" seed_var="CES_WALLET${i}_SEED"
    if [ -n "${!mnemonic_var:-}" ] && [ ! -f "${!mnemonic_var}" ]; then
      local wallet_file="$ROOT_DIR/wallet-mnemonic-$i.$MIDNIGHT_NETWORK.ci.txt"
      printf '%s\n' "${!mnemonic_var}" > "$wallet_file"
     
      CREATED_FILES+=("$wallet_file")
      export "${mnemonic_var}=$wallet_file"
    elif [ -n "${!seed_var:-}" ] && [ ! -f "${!seed_var}" ]; then
      local wallet_file="$ROOT_DIR/wallet-seed-$i.$MIDNIGHT_NETWORK.ci.hex"
      printf '%s\n' "${!seed_var}" > "$wallet_file"
      
      CREATED_FILES+=("$wallet_file")
      export "${seed_var}=$wallet_file"
    fi
  done
  umask "$old_umask"
}

cleanup() {
  if [ "${#PIDS[@]}" -gt 0 ]; then
    log "Stopping servers..."
    for server_pid in "${PIDS[@]}"; do
      kill "$server_pid" 2>/dev/null && log "Stopped PID $server_pid" || true
    done
  fi
  for created_file in "${CREATED_FILES[@]+"${CREATED_FILES[@]}"}"; do
    rm -f "$created_file"
  done
  rm -f "$CES_SERVER_NO_DUST_PRICE_CONFIG"
}

clear_logs() {
  for ((i=1; i<=N; i++)); do
    rm -f "$LOG_DIR/server$i.log"
  done
}

validate_args() {
  if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 2 ]; then
    log "ERROR: N must be at least 2 (1 no-dust + at least 1 funded server)"
    exit 1
  fi
}

resolve_server1_wallet() {
  local mnemonic="${CES_WALLET_MNEMONIC_NO_DUST_PREVIEW:-$ROOT_DIR/wallet-mnemonic-no-dust.$MIDNIGHT_NETWORK.txt}"
  local seed="${CES_WALLET_SEED_NO_DUST_PREVIEW:-}"
  if [ -f "$mnemonic" ]; then
    NO_DUST_WALLET_KEY="WALLET_MNEMONIC_FILE"
    NO_DUST_WALLET_VAL="$mnemonic"
  elif [ -n "$seed" ] && [ -f "$seed" ]; then
    NO_DUST_WALLET_KEY="WALLET_SEED_FILE"
    NO_DUST_WALLET_VAL="$seed"
  else
    log "ERROR: No-dust Server wallet not found. Set CES_WALLET_MNEMONIC_NO_DUST_PREVIEW or CES_WALLET_SEED_NO_DUST_PREVIEW."
    exit 1
  fi
}

validate_n_wallets() {
  for ((i=2; i<=N; i++)); do
    local mnemonic_var="CES_WALLET${i}_MNEMONIC" seed_var="CES_WALLET${i}_SEED"
    local mnemonic_file_i="${!mnemonic_var:-$ROOT_DIR/wallet-mnemonic-$i.$MIDNIGHT_NETWORK.txt}"
    local seed_file_i="${!seed_var:-$ROOT_DIR/wallet-seed-$i.$MIDNIGHT_NETWORK.hex}"
    if [ ! -f "$mnemonic_file_i" ] && [ ! -f "$seed_file_i" ]; then
      log "ERROR: Server $i wallet not found. Create one of the following files or set CES_WALLET${i}_MNEMONIC / CES_WALLET${i}_SEED in the environment:"
      log "  $mnemonic_file_i"
      log "  $seed_file_i"
      exit 1
    fi
  done
}

generate_quote_secrets() {
  for ((i=1; i<=N; i++)); do
    local quote_secret_i="$PROJECT_ROOT/.quote-secret-$i.hex"
    [ -f "$quote_secret_i" ] && continue
    log "Generating quote secret for server $i"
    generate_quote_secret "$quote_secret_i"
    CREATED_FILES+=("$quote_secret_i")
  done
}

generate_funded_price_config() {
  [ -f "$CES_SERVER_PRICE_CONFIG" ] && return
  log "Generating price config"
  if [ -z "${DERIVED_TOKEN_COLOR:-}" ] || [ -z "${UNSHIELDED_TOKEN_COLOR:-}" ] || [ -z "${TOKEN_MINT_ADDRESS:-}" ]; then
    log "ERROR: Cannot generate $CES_SERVER_PRICE_CONFIG — set DERIVED_TOKEN_COLOR, UNSHIELDED_TOKEN_COLOR and TOKEN_MINT_ADDRESS"
    exit 1
  fi
  bun "$ROOT_DIR/scripts/gen-price-config.ts" "$CES_SERVER_PRICE_CONFIG" "$DERIVED_TOKEN_COLOR" "$UNSHIELDED_TOKEN_COLOR" "$TOKEN_MINT_ADDRESS"
}

generate_server1_price_config() {
  [ -f "$CES_SERVER_NO_DUST_PRICE_CONFIG" ] && return
  log "Generating server 1 price config (with peer.maxPrices for DUST fallback)"
  if [ -z "${DERIVED_TOKEN_COLOR:-}" ] || [ -z "${UNSHIELDED_TOKEN_COLOR:-}" ] || [ -z "${TOKEN_MINT_ADDRESS:-}" ]; then
    log "ERROR: Cannot generate $CES_SERVER_NO_DUST_PRICE_CONFIG — set DERIVED_TOKEN_COLOR, UNSHIELDED_TOKEN_COLOR and TOKEN_MINT_ADDRESS"
    exit 1
  fi
  bun "$ROOT_DIR/scripts/gen-price-config.ts" "$CES_SERVER_NO_DUST_PRICE_CONFIG" "$DERIVED_TOKEN_COLOR" "$UNSHIELDED_TOKEN_COLOR" "$TOKEN_MINT_ADDRESS" --with-peer-max-prices
}

check_balances() {
  [ "$SKIP_BALANCE_CHECK" = "1" ] && return
  log "Checking balances on '$MIDNIGHT_NETWORK' (this may take a moment)..."
  local mnemonics=()
  for ((i=2; i<=N; i++)); do
    local mnemonic_var="CES_WALLET${i}_MNEMONIC" seed_var="CES_WALLET${i}_SEED"
    local mnemonic_file_i="${!mnemonic_var:-$ROOT_DIR/wallet-mnemonic-$i.$MIDNIGHT_NETWORK.txt}"
    local seed_file_i="${!seed_var:-$ROOT_DIR/wallet-seed-$i.$MIDNIGHT_NETWORK.hex}"
    if [ -f "$mnemonic_file_i" ]; then
      mnemonics+=(--mnemonic "$mnemonic_file_i")
    else
      mnemonics+=(--seed "$seed_file_i")
    fi
  done
  local server1_flag="--server1-mnemonic"
  [ "$NO_DUST_WALLET_KEY" = "WALLET_SEED_FILE" ] && server1_flag="--server1-seed"
  bun "$ROOT_DIR/scripts/check-server-balances.ts" \
    --network "$MIDNIGHT_NETWORK" \
    "$server1_flag" "$NO_DUST_WALLET_VAL" \
    --wallet-state-dir "$WALLET_STATE_DIR" \
    --chain-snapshot-dir "$CHAIN_SNAPSHOT_DIR" \
    "${mnemonics[@]}"
}

build_peer_urls() {
  PEER_URLS=""
  for ((i=2; i<=N; i++)); do
    local port=$((BASE_PORT + i - 1))
    PEER_URLS="${PEER_URLS:+$PEER_URLS,}http://localhost:$port"
  done
}

start_server1() {
  local log_path="$LOG_DIR/server1.log"
  log "Starting No-dust Server on port $BASE_PORT (no-dust wallet, peers -> $PEER_URLS)..."
  env -u WALLET_SEED_FILE -u WALLET_MNEMONIC_FILE \
    "$NO_DUST_WALLET_KEY=$NO_DUST_WALLET_VAL" \
    PORT="$BASE_PORT" \
    DASHBOARD_PORT="$BASE_DASHBOARD_PORT" \
    MIDNIGHT_NETWORK="$MIDNIGHT_NETWORK" \
    PRICE_CONFIG_FILE="$CES_SERVER_NO_DUST_PRICE_CONFIG" \
    CAPACITY_EXCHANGE_PEER_URLS="$PEER_URLS" \
    QUOTE_SECRET_FILE="$PROJECT_ROOT/.quote-secret-1.hex" \
    WALLET_STATE_DIR="$WALLET_STATE_DIR" \
    QUOTE_TTL_SECONDS="$QUOTE_TTL_SECONDS" \
    OFFER_TTL_SECONDS="$OFFER_TTL_SECONDS" \
    LOG_LEVEL="$LOG_LEVEL" \
    bun "$PROJECT_ROOT/src/server.ts" >> "$log_path" 2>&1 &
  local pid=$!
  PIDS+=($pid)
  log "No-dust Server started (PID $pid) — logs: $log_path"
}

start_n_servers() {
  for ((i=2; i<=N; i++)); do
    local port_i=$((BASE_PORT + i - 1))
    local dashboard_port_i=$((BASE_DASHBOARD_PORT + i - 1))
    local mnemonic_var="CES_WALLET${i}_MNEMONIC" seed_var="CES_WALLET${i}_SEED"
    local mnemonic_file_i="${!mnemonic_var:-$ROOT_DIR/wallet-mnemonic-$i.$MIDNIGHT_NETWORK.txt}"
    local seed_file_i="${!seed_var:-$ROOT_DIR/wallet-seed-$i.$MIDNIGHT_NETWORK.hex}"
    local quote_secret_i="$PROJECT_ROOT/.quote-secret-$i.hex"
    local log_path_i="$LOG_DIR/server$i.log"
    local wallet_key wallet_val
    if [ -f "$mnemonic_file_i" ]; then
      wallet_key="WALLET_MNEMONIC_FILE"
      wallet_val="$mnemonic_file_i"
    else
      wallet_key="WALLET_SEED_FILE"
      wallet_val="$seed_file_i"
    fi

    log "Starting server $i on port $port_i (funded wallet, $wallet_key: $wallet_val)..."
    env -u WALLET_SEED_FILE -u WALLET_MNEMONIC_FILE -u CAPACITY_EXCHANGE_PEER_URLS \
      PORT="$port_i" \
      DASHBOARD_PORT="$dashboard_port_i" \
      MIDNIGHT_NETWORK="$MIDNIGHT_NETWORK" \
      "$wallet_key=$wallet_val" \
      PRICE_CONFIG_FILE="$CES_SERVER_PRICE_CONFIG" \
      QUOTE_SECRET_FILE="$quote_secret_i" \
      WALLET_STATE_DIR="$WALLET_STATE_DIR" \
      QUOTE_TTL_SECONDS="$QUOTE_TTL_SECONDS" \
      OFFER_TTL_SECONDS="$OFFER_TTL_SECONDS" \
      LOG_LEVEL="$LOG_LEVEL" \
      bun "$PROJECT_ROOT/src/server.ts" >> "$log_path_i" 2>&1 &
    local pid=$!
    PIDS+=($pid)
    log "Server $i started (PID $pid) — logs: $log_path_i"
  done
}

print_summary() {
  log "$N servers running. Press Ctrl+C to stop."
  log "  No-dust Server: http://localhost:$BASE_PORT  (no dust, peers -> $PEER_URLS)  dashboard: http://localhost:$BASE_DASHBOARD_PORT"
  for ((i=2; i<=N; i++)); do
    local port=$((BASE_PORT + i - 1))
    local dashboard_port=$((BASE_DASHBOARD_PORT + i - 1))
    log "  Server $i: http://localhost:$port  (funded wallet)  dashboard: http://localhost:$dashboard_port"
  done
}

trap cleanup EXIT
trap 'exit' TERM INT
cd "$ROOT_DIR"

validate_args
clear_logs
write_wallet_files
resolve_server1_wallet
validate_n_wallets
generate_quote_secrets
generate_funded_price_config
generate_server1_price_config
check_balances
build_peer_urls
start_n_servers
start_server1
print_summary

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "ERROR: Server (PID $pid) exited unexpectedly"
      exit 1
    fi
  done
  sleep 2
done
