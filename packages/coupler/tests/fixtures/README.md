# disclosure fixtures

`disclosureTxs.json` holds real coupling transactions from preview, saved as hex. The tests read them from disk instead of deploying a contract and submitting to a chain, so they run faster and offline.

Each entry in `couplings` has a `label` to select it by, the `couplerAddress` it settled against, its `txId`, the raw saved transaction as `raw`, and the `s` and hash of `s'` that coupling revealed, as `expectedS` and `expectedHsp`.

## If these ever need rebuilding

Producing new ones means running real couplings against a network and saving each submitted transaction along with the `s` and hash of `s'` it disclosed, plus the coupler it settled against.

The e2e harness does both, one run at a time. Each run couples twice, so two runs give the three entries here. The first deploys a coupler, and `COUPLER_ADDRESS` points the second at that same one, which is what keeps every entry readable:

```bash
cd apps/coupler-cli
FIXTURES=../../packages/coupler/tests/fixtures/disclosureTxs.json

# first run: deploys a coupler, writes coupling1 and coupling2
COUNTER_ADDRESS=$(gh variable get E2E_COUNTER_ADDRESS_PREVIEW) \
CHAIN_SNAPSHOT_DIR=../../.chain-snapshots \
WALLET_MNEMONIC_FILE=../../wallet-mnemonic.preview.txt \
WALLET_STATE_DIR=../../.wallet-state-preview \
bun run coupler:e2e preview --save-fixtures "$FIXTURES"

# second run: reuses that coupler, appends coupling3
COUPLER_ADDRESS=<couplerAddress from the first run> \
COUNTER_ADDRESS=$(gh variable get E2E_COUNTER_ADDRESS_PREVIEW) \
CHAIN_SNAPSHOT_DIR=../../.chain-snapshots \
WALLET_MNEMONIC_FILE=../../wallet-mnemonic.preview.txt \
WALLET_STATE_DIR=../../.wallet-state-preview \
bun run coupler:e2e preview --save-fixtures "$FIXTURES"
```

Delete the file first to start over, since a run appends. Appending a run settled against a different coupler is refused rather than written, because the reader would drop those entries without saying so.

Below is how to fetch a transaction's bytes by hand, if you ever have a txId but not the run that produced it.

Given a transaction's identifier, which each entry stores as `txId`, this fetches the bytes to save:

```bash
INDEXER=https://indexer.preview.midnight.network/api/v3/graphql
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"<hex>\" }) { raw } }"}'
```

The ones saved here can be fetched today:

```bash
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"000ea886be02bb3adbd3ede8d244d452c42bcf41eb9e21975c79af7e15100a1203\" }) { raw } }"}'   # coupling1
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"00cec0df7119412d2302def2c57c4980ef99633c81c02b1ac178073d9616e2e15b\" }) { raw } }"}'   # coupling2
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"001aba7268547d005438e6ccab2ae47f02c3403efd18312d0b498ec3824e674ba6\" }) { raw } }"}'   # coupling3
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"0066e316992459625bab112dc2f9bb780a5a21560098f1ee8d1710c1de1f909ac0\" }) { raw } }"}'   # trimmedS
```
