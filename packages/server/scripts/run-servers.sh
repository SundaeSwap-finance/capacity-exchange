#!/usr/bin/env bash
# Usage: run-servers.sh [N]
#
# Starts N servers:
#   - Server 1: no-dust wallet; peers to all funded servers (2..N)
#   - Servers 2..N: funded wallets; no peers (serve dust directly)
#
# Ports: server i runs on BASE_PORT + i - 1  (default base: 3000)
#
# Wallet config:
#   - Server 1 wallet: SERVER1_WALLET_MNEMONIC_FILE (default: ../../wallet-mnemonic-no-dust.<MIDNIGHT_NETWORK>.txt)
#     The file MUST exist and the wallet MUST have shielded token balance (set SKIP_BALANCE_CHECK=1 to bypass).
#   - Servers 2..N wallets: each uses wallet-mnemonic-{i}.{MIDNIGHT_NETWORK}.txt (e.g. wallet-mnemonic-2.preview.txt)
#     with a separate WALLET_STATE_DIR (.wallet-state-{i}).
#     These wallets MUST have a DUST balance (set SKIP_BALANCE_CHECK=1 to bypass).
# Override any default with env vars before calling this script.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Args ───────────────────────────────────────────────────────────────────────
N="${1:-2}"
if [ "$N" -lt 2 ]; then
  echo "Error: N must be at least 2 (1 no-dust + at least 1 funded server)"
  exit 1
fi

BASE_PORT="${BASE_PORT:-3000}"
BASE_DASHBOARD_PORT="${BASE_DASHBOARD_PORT:-4000}"
LOG_DIR="${LOG_DIR:-$PROJECT_ROOT}"

# ── Load base .env ─────────────────────────────────────────────────────────────
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-preview}"
SERVER1_WALLET_MNEMONIC_FILE="${SERVER1_WALLET_MNEMONIC_FILE:-$PROJECT_ROOT/../../wallet-mnemonic-no-dust.${MIDNIGHT_NETWORK}.txt}"

# ── Require server 1 wallet mnemonic ───────────────────────────────────────────
if [ ! -f "$SERVER1_WALLET_MNEMONIC_FILE" ]; then
  echo "Error: Server 1 wallet mnemonic not found at $SERVER1_WALLET_MNEMONIC_FILE"
  echo "Create it with a funded BIP39 mnemonic:"
  echo "  echo 'word1 word2 ... word24' > $SERVER1_WALLET_MNEMONIC_FILE"
  exit 1
fi

# ── Check server 1 must have shielded balance but NO dust balance ──────────────
if [ "${SKIP_BALANCE_CHECK:-0}" != "1" ]; then
  if [ "$MIDNIGHT_NETWORK" = "mainnet" ]; then
    echo "Error: This script is for testing only and does not support MIDNIGHT_NETWORK=mainnet."
    exit 1
  fi
  echo "Checking server 1 shielded balance on '$MIDNIGHT_NETWORK' (this may take a moment)..."
  if ! bun "$SCRIPT_DIR/check-balance/shielded-balance.ts" "$SERVER1_WALLET_MNEMONIC_FILE" "$MIDNIGHT_NETWORK"; then
    echo ""
    echo "Error: Server 1 wallet has no shielded balance."
    echo "Fund it with shielded tokens at $SERVER1_WALLET_MNEMONIC_FILE before starting."
    echo "Set SKIP_BALANCE_CHECK=1 to bypass this check."
    exit 1
  fi

  echo "Checking server 1 has no DUST balance (it should rely on peer CES servers for dust)..."
  if bun "$SCRIPT_DIR/check-balance/dust-balance.ts" "$SERVER1_WALLET_MNEMONIC_FILE" "$MIDNIGHT_NETWORK" 2>/dev/null; then
    echo ""
    echo "Warning: Server 1 wallet has a DUST balance."
    echo "Server 1 is intended to be a no-dust wallet that acquires dust from peer CES servers."
    echo "Using a wallet with existing dust may cause unexpected behaviour."
    echo "Set SKIP_BALANCE_CHECK=1 to bypass this check."
    exit 1
  fi
fi

# ── Require per-server wallet mnemonics, dust balance and ensure price configs exist ────
DEFAULT_PRICE_CONFIG="$PROJECT_ROOT/price-config.${MIDNIGHT_NETWORK}.json"
for i in $(seq 2 "$N"); do
  MNEMONIC_FILE_I="$PROJECT_ROOT/../../wallet-mnemonic-${i}.${MIDNIGHT_NETWORK}.txt"
  if [ ! -f "$MNEMONIC_FILE_I" ]; then
    echo "Error: Server $i wallet mnemonic not found at $MNEMONIC_FILE_I"
    echo "Create it with a funded BIP39 mnemonic:"
    echo "  echo 'word1 word2 ... word24' > $MNEMONIC_FILE_I"
    exit 1
  fi

  PRICE_CONFIG_I="$PROJECT_ROOT/price-config-${i}.${MIDNIGHT_NETWORK}.json"
  if [ ! -f "$PRICE_CONFIG_I" ]; then
    if [ ! -f "$DEFAULT_PRICE_CONFIG" ]; then
      echo "Error: Cannot create $PRICE_CONFIG_I — default config not found at $DEFAULT_PRICE_CONFIG"
      exit 1
    fi
    cp "$DEFAULT_PRICE_CONFIG" "$PRICE_CONFIG_I"
    echo "Created $PRICE_CONFIG_I from $DEFAULT_PRICE_CONFIG"
  fi

  if [ "${SKIP_BALANCE_CHECK:-0}" != "1" ]; then
    echo "Checking server $i DUST balance on '$MIDNIGHT_NETWORK' (this may take a moment)..."
    if ! bun "$SCRIPT_DIR/check-balance/dust-balance.ts" "$MNEMONIC_FILE_I" "$MIDNIGHT_NETWORK"; then
      echo ""
      echo "Error: Server $i wallet has no DUST balance."
      echo "Register unshielded NIGHT UTxOs for dust generation first:"
      echo "  cd packages/midnight-node && WALLET_STATE_DIR=../server/.wallet-state-$i bun src/cli/balances.ts $MIDNIGHT_NETWORK --register-dust"
      echo "Set SKIP_BALANCE_CHECK=1 to bypass this check."
      exit 1
    fi
  fi
done

# ── Build peer URL list for server 1 (all funded servers) ─────────────────────
PEER_URLS=""
for i in $(seq 2 "$N"); do
  PORT_I=$((BASE_PORT + i - 1))
  if [ -z "$PEER_URLS" ]; then
    PEER_URLS="http://localhost:$PORT_I"
  else
    PEER_URLS="$PEER_URLS,http://localhost:$PORT_I"
  fi
done

# ── Track PIDs for cleanup ─────────────────────────────────────────────────────
declare -a PIDS=()

cleanup() {
  echo ""
  echo "Stopping servers..."
  for i in "${!PIDS[@]}"; do
    PID="${PIDS[$i]}"
    SERVER_NUM=$((i + 1))
    [ -n "$PID" ] && kill "$PID" 2>/dev/null && echo "Server $SERVER_NUM (PID $PID) stopped"
  done
  # Force-kill any remaining processes still bound to the server ports
  for i in $(seq 1 "$N"); do
    PORT_I=$((BASE_PORT + i - 1))
    LEFTOVER=$(lsof -ti:"$PORT_I" 2>/dev/null)
    if [ -n "$LEFTOVER" ]; then
      echo "Force-killing leftover process on port $PORT_I (PID $LEFTOVER)"
      kill -9 $LEFTOVER 2>/dev/null
    fi
  done
}
trap cleanup EXIT INT TERM

# ── Start server 1 (no dust — peers to all funded servers) ────────────────────
SERVER1_PORT=$BASE_PORT
echo "Starting server 1 on port $SERVER1_PORT (no-dust wallet, peers -> $PEER_URLS)..."
(
  export PORT=$SERVER1_PORT
  export DASHBOARD_PORT=$BASE_DASHBOARD_PORT
  export WALLET_STATE_DIR="$PROJECT_ROOT/.wallet-state-nodust"
  export WALLET_MNEMONIC_FILE="$SERVER1_WALLET_MNEMONIC_FILE"
  export CAPACITY_EXCHANGE_PEER_URLS="$PEER_URLS"
  unset WALLET_SEED_FILE
  bun "$PROJECT_ROOT/src/server.ts"
) > "$LOG_DIR/server1.log" 2>&1 &
SERVER1_PID=$!
PIDS+=($SERVER1_PID)
echo "Server 1 started (PID $SERVER1_PID) — logs: $LOG_DIR/server1.log"

# ── Start funded servers 2..N ─────────────────────────────────────────────────
for i in $(seq 2 "$N"); do
  PORT_I=$((BASE_PORT + i - 1))
  MNEMONIC_FILE_I="$PROJECT_ROOT/../../wallet-mnemonic-${i}.${MIDNIGHT_NETWORK}.txt"
  echo "Starting server $i on port $PORT_I (funded wallet, mnemonic: $MNEMONIC_FILE_I)..."
  (
    export PORT=$PORT_I
    export DASHBOARD_PORT=$((BASE_DASHBOARD_PORT + i - 1))
    export WALLET_STATE_DIR="$PROJECT_ROOT/.wallet-state-$i"
    export WALLET_MNEMONIC_FILE="$MNEMONIC_FILE_I"
    export PRICE_CONFIG_FILE="$PROJECT_ROOT/price-config-${i}.${MIDNIGHT_NETWORK}.json"
    export QUOTE_SECRET_FILE="$PROJECT_ROOT/.quote-secret-${i}.hex"
    unset WALLET_SEED_FILE
    unset CAPACITY_EXCHANGE_PEER_URLS
    bun "$PROJECT_ROOT/src/server.ts"
  ) > "$LOG_DIR/server${i}.log" 2>&1 &
  SERVER_PID=$!
  PIDS+=($SERVER_PID)
  echo "Server $i started (PID $SERVER_PID) — logs: $LOG_DIR/server${i}.log"
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "$N servers running. Press Ctrl+C to stop."
echo "  Server 1: http://localhost:$BASE_PORT  (no dust, peers -> $PEER_URLS)  dashboard: $BASE_DASHBOARD_PORT"
for i in $(seq 2 "$N"); do
  PORT_I=$((BASE_PORT + i - 1))
  DASHBOARD_PORT_I=$((BASE_DASHBOARD_PORT + i - 1))
  echo "  Server $i: http://localhost:$PORT_I  (funded wallet)  dashboard: $DASHBOARD_PORT_I"
done
echo ""

wait