---
'@capacity-exchange/server': major
---

Environment variables are renamed after the chain they configure. The old names are no longer read.

| Old | New |
| --- | --- |
| `WALLET_SEED_FILE` | `MIDNIGHT_WALLET_SEED_FILE` |
| `WALLET_MNEMONIC_FILE` | `MIDNIGHT_WALLET_MNEMONIC_FILE` |
| `WALLET_MNEMONIC_ARN` | `MIDNIGHT_WALLET_MNEMONIC_ARN` |
| `WALLET_MNEMONIC_SECRET_NAME` | `MIDNIGHT_WALLET_MNEMONIC_SECRET_NAME` |
| `WALLET_STATE_DIR` | `MIDNIGHT_WALLET_STATE_DIR` |
| `PROOF_SERVER_URL` | `MIDNIGHT_PROOF_SERVER_URL` |
| `BLOCKFROST_API_KEY` | `CARDANO_BLOCKFROST_API_KEY` |
| `BLOCKFROST_BASE_URL` | `CARDANO_BLOCKFROST_BASE_URL` |

OpenTelemetry metrics are named by capacity asset rather than DUST, with an `asset` attribute:

| Old | New |
| --- | --- |
| `ces.dust.committed_specks` | `ces.capacity.committed` |
| `ces.utxo.locked_count` | `ces.capacity.locked_utxos` |
| `ces.utxo.locked_specks` | `ces.capacity.locked_amount` |
| `ces.utxo.total_count` | `ces.capacity.total_utxos` |
| `ces.utxo.total_specks` | `ces.capacity.available_amount` |

The HTTP API changes are described in the `@sundaeswap/capacity-exchange-client` changelog.
