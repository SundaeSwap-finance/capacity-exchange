# disclosure fixtures

`disclosureTxs.json` holds real coupling transactions from preview, saved as hex. The tests read them from disk instead of deploying a contract and submitting to a chain, so they run faster and offline.

Each entry in `couplings` has a `label` to select it by, the `couplerAddress` it settled against, its `txId`, the raw saved transaction as `raw`, and the `s` and hash of `s'` that coupling revealed, as `expectedS` and `expectedHsp`.

The tests select `coupling1`, `coupling2` and `coupling3` by label, and expect all three to have settled against the same coupler. Every entry, whatever its label, is also decoded and checked against its `expectedS` and `expectedHsp`.

The ledger stores a value with its trailing zero bytes trimmed, so a secret ending in a zero byte (about 1 coupling in 256) reaches the decoder short. Captures can't produce one on demand, so `disclosure.test.ts` builds one from a real reveal instead (`a secret ending in zero bytes`), and `packages/midnight-core/tests/cellWrites.test.ts` covers the cell read on its own.

## If these ever need rebuilding

The transactions must be in the format of the ledger the tests decode with, so a ledger upgrade means capturing them again.

`coupler:capture` in `apps/coupler-cli` couples once against an existing coupler, waits for the transaction to land, reads back what it disclosed, and appends one entry to the file, creating it when absent. It does not deploy, so deploy a coupler first and pass its address to every capture. Three captures give `coupling1` through `coupling3`:

```bash
cd apps/coupler-cli
export WALLET_MNEMONIC_FILE=../../wallet-mnemonic.preview.txt
export WALLET_STATE_DIR=../../.wallet-state-preview
export CHAIN_SNAPSHOT_DIR=../../.chain-snapshots
export COUNTER_ADDRESS=$(gh variable get E2E_COUNTER_ADDRESS_PREVIEW)
FIXTURES=../../packages/coupler/tests/fixtures/disclosureTxs.json

# prints the new coupler's address
bun run coupler:deploy preview
export COUPLER_ADDRESS=<address printed above>

rm -f "$FIXTURES"
# stops at the first failure, so a failed capture isn't hidden by the next one
for i in 1 2 3; do bun run coupler:capture preview --out "$FIXTURES" || break; done
```

Unlabelled entries are named `coupling1`, `coupling2` and so on, skipping names already in the file. Labels already in the file are kept.

The counter at `COUNTER_ADDRESS` must also be readable by the current ledger. If it was deployed before a ledger upgrade and has not been touched since, deploy a new one or rotate its verifier keys first.

## Fetching a saved transaction by hand

If you have a `txId` but not the run that produced it, this fetches the bytes to save as `raw`:

```bash
INDEXER=https://indexer.preview.midnight.network/api/v3/graphql
curl -s -X POST "$INDEXER" -H 'Content-Type: application/json' \
  -d '{"query":"query { transactions(offset: { identifier: \"<txId>\" }) { raw } }"}'
```
