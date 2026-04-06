# Demo Contracts

Midnight smart contracts for counter and token-mint demos.

## Requirements

1. **Node.js** and **npm**
2. **compactc v0.26.108-rc.0** - Midnight Compact compiler
3. **ZK params** - use the script at [midnight-proof-server/fetch-zk-params.sh](https://github.com/bricktowers/midnight-proof-server/blob/1f129eb400bf2678d7808a8c96b071e184ca2e7c/fetch-zk-params.sh) to download proving keys. Modify `ZK_PARAMS_DIR` to point to `$HOME/.cache/midnight/zk-params` (where compactc looks for them).

## Setup

```bash
npm install
```

Create a `.env` file:

```env
WALLET_SEED_FILE=wallet-seed.hex
MIDNIGHT_NETWORK=testnet
NODE_WS_URL=wss://rpc.testnet.midnight.network
PROOF_SERVER_URL=https://proof.testnet.midnight.network
INDEXER_URL=https://indexer.testnet.midnight.network
INDEXER_WS_URL=wss://indexer.testnet.midnight.network
```

Create a `wallet-seed.hex` file with a 64-character hex seed.

## Scripts

Compile contracts (requires `COMPACTC` env var):

```bash
COMPACTC=/path/to/compactc npm run compile
```

Type-check:

```bash
npm run build
```

Run e2e tests:

```bash
npm run counter:e2e
npm run token-mint:e2e -- 1000
```

Clean compiled output:

```bash
npm run clean
```
