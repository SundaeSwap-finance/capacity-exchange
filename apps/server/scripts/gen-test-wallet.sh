#!/usr/bin/env bash
set -e

# Load env vars
source "$(dirname "$0")/env.sh"

: "${MIDNIGHT_NETWORK:?Error: MIDNIGHT_NETWORK is required}"
: "${NODE_WS_URL:?Error: NODE_WS_URL is required}"
: "${TOOLKIT_VERSION:?Error: TOOLKIT_VERSION is required}"

if [ $# -ne 2 ]; then
  echo "Usage: $0 <night_amount> <num_txs>"
  echo "  night_amount: Amount of NIGHT to send per transaction"
  echo "  num_txs: Number of transactions to send"
  exit 1
fi

FUND_AMOUNT="$1"
NUM_TXS="$2"

FUNDING_SEED="0000000000000000000000000000000000000000000000000000000000000001"
TOOLKIT_IMAGE="midnightntwrk/midnight-node-toolkit:${TOOLKIT_VERSION}"
OUTPUT_SEED_FILE="wallet-seed.hex"

toolkit_helper() {
  docker run --rm --network host \
    -e MN_FETCH_CACHE=redb:/out/.sync_cache/e2e_test.db \
    -v $(pwd)/.sync_cache:/out/.sync_cache \
    "$TOOLKIT_IMAGE" \
    "$@"
}

echo "Provisioning test wallet..."
echo "Network: $MIDNIGHT_NETWORK"

TEST_SEED=$(openssl rand -hex 32)
echo "Generated seed: $TEST_SEED"

echo "Deriving addresses..."
ADDR_JSON=$(toolkit_helper show-address --network "$MIDNIGHT_NETWORK" --seed "$TEST_SEED")

TEST_UNSHIELDED_ADDR=$(echo "$ADDR_JSON" | jq -r '.unshielded')
TEST_DUST_ADDR=$(echo "$ADDR_JSON" | jq -r '.dust')

echo "Unshielded addr: $TEST_UNSHIELDED_ADDR"
echo "DUST addr:       $TEST_DUST_ADDR"

echo "Registering DUST address..."
toolkit_helper generate-txs \
  --src-url "$NODE_WS_URL" \
  --dest-url "$NODE_WS_URL" \
  register-dust-address \
  --wallet-seed "$TEST_SEED" \
  --funding-seed "$FUNDING_SEED" \
  # --destination-dust "$TEST_DUST_ADDR"

echo "Sending $FUND_AMOUNT NIGHT, $NUM_TXS times, to new wallet"

for i in $(seq 1 "$NUM_TXS"); do
  echo "Funding UTxO #$i..."
  toolkit_helper generate-txs \
    --src-url "$NODE_WS_URL" \
    --dest-url "$NODE_WS_URL" \
    single-tx \
    --source-seed "$FUNDING_SEED" \
    --unshielded-amount "$FUND_AMOUNT" \
    --destination-address "$TEST_UNSHIELDED_ADDR"
done

echo "Verifying DUST balance..."
toolkit_helper dust-balance --seed "$TEST_SEED" --src-url "$NODE_WS_URL"

echo "Saving seed to $OUTPUT_SEED_FILE..."
# Overwrite the file to ensure clean state for the test run
echo -n "$TEST_SEED" > "$OUTPUT_SEED_FILE"

echo "Test wallet provisioned"
