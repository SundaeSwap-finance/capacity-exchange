#!/usr/bin/env bash
# Writes a fresh single-pool devnet that starts in the Dijkstra era into /devnet.
# Runs inside the cardano-node image, whose Musashi config in /app/config is the base.
set -euo pipefail

MAGIC=42
BASE=/app/config
KEYS=/keys
OUT=/devnet

rm -rf "$OUT"/*
cd "$OUT"

jq --argjson magic $MAGIC '
  .slotLength=1 | .epochLength=500 | .activeSlotsCoeff=1.0 | .securityParam=10
  | .networkMagic=$magic | .protocolParams.protocolVersion.major=12' \
  "$BASE/shelley-genesis.json" > shelley-spec.json
cardano-cli dijkstra genesis create-testnet-data \
  --spec-shelley shelley-spec.json \
  --spec-alonzo "$BASE/alonzo-genesis.json" \
  --spec-conway "$BASE/conway-genesis.json" \
  --pools 1 --testnet-magic $MAGIC \
  --total-supply 45000000000000000 --delegated-supply 1000000000000000 \
  --out-dir . > /dev/null

# The CLI writes a mainline Dijkstra template (Peras keys, a 369-entry PlutusV4 cost
# model) that this Leios node rejects, and the node also wants the Peras keys Musashi's
# file lacks. The node gets Musashi's parameters plus those keys; Dolos rejects unknown
# keys, so it gets Musashi's file as is.
jq -s '.[0] * .[1]' dijkstra-genesis.json "$BASE/dijkstra-genesis.json" > t && mv t dijkstra-genesis.json
cp "$BASE/dijkstra-genesis.json" dolos-dijkstra-genesis.json

# Dolos only parses the committee threshold as a fraction; the CLI writes a bare 0.
jq '.committee.threshold={numerator:0, denominator:1}' conway-genesis.json > t && mv t conway-genesis.json

POOL_KEYS=pools-keys/pool1
POOL=$(cardano-cli latest stake-pool id --cold-verification-key-file $POOL_KEYS/cold.vkey --output-format hex)
VRF=$(cardano-cli latest node key-hash-VRF --verification-key-file $POOL_KEYS/vrf.vkey)
REWARD=$(cardano-cli latest stake-address key-hash --stake-verification-key-file $POOL_KEYS/staking-reward.vkey)
cardano-cli latest stake-address key-gen --verification-key-file delegator.vkey --signing-key-file delegator.skey
DELEGATOR=$(cardano-cli latest stake-address key-hash --stake-verification-key-file delegator.vkey)

addr_hex() { cardano-cli address info --address "$1" | jq -r .base16; }
# The funded key gets two outputs: an enterprise address for tests to spend from, and
# one staked to the pool so that the pool has stake to forge with.
ENTERPRISE=$(cardano-cli latest address build --payment-verification-key-file $KEYS/funded.vkey \
  --testnet-magic $MAGIC)
STAKED=$(cardano-cli latest address build --payment-verification-key-file $KEYS/funded.vkey \
  --stake-verification-key-file delegator.vkey --testnet-magic $MAGIC)

START=$(date -u -d '+5 sec' +%s)
# The CLI leaves both the legacy staking fields and extraConfig empty, and the node
# refuses a genesis that has both, so drop extraConfig and fill in the legacy fields.
jq --arg p "$POOL" --arg v "$VRF" --arg r "$REWARD" --arg d "$DELEGATOR" \
   --arg enterprise "$(addr_hex "$ENTERPRISE")" --arg staked "$(addr_hex "$STAKED")" \
   --arg t "$(date -u -d @"$START" +%FT%TZ)" '
  del(.extraConfig)
  | .systemStart=$t
  | .initialFunds={($enterprise):1000000000000000, ($staked):1000000000000000}
  | .staking={pools:{($p):{publicKey:$p, vrf:$v, pledge:0, cost:0, margin:0,
      rewardAccount:{network:"Testnet",credential:{keyHash:$r}}, owners:[], relays:[], metadata:null}},
      stake:{($d):$p}}' shelley-genesis.json > t && mv t shelley-genesis.json
jq --argjson t "$START" '.startTime=$t' byron-genesis.json > t && mv t byron-genesis.json

jq 'del(.ByronGenesisHash, .ShelleyGenesisHash, .AlonzoGenesisHash, .ConwayGenesisHash,
        .DijkstraGenesisHash, .TraceOptionForwarder)
    | .TestDijkstraHardForkAtEpoch=0' "$BASE/config.json" > config.json
echo '{"localRoots":[],"publicRoots":[],"useLedgerAfterSlot":-1}' > topology.json

mkdir -p dolos
cat > dolos/dolos.toml <<EOF
[upstream]
peer_address = "node:3001"

[storage]
version = "v4"
path = "$OUT/dolos/data"

[genesis]
byron_path = "$OUT/byron-genesis.json"
shelley_path = "$OUT/shelley-genesis.json"
alonzo_path = "$OUT/alonzo-genesis.json"
conway_path = "$OUT/conway-genesis.json"
dijkstra_path = "$OUT/dolos-dijkstra-genesis.json"
force_protocol = 12

[serve.grpc]
listen_address = "0.0.0.0:50051"

[chain]
type = "cardano"
magic = $MAGIC
is_testnet = true

[logging]
max_level = "INFO"
EOF
