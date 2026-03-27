# Balances CLI

View your Midnight wallet addresses and balances. The examples below use `preview` but the CLI supports `undeployed`, `preprod`, and `mainnet` as well.

## Requirements

- `bun`
- A Midnight wallet mnemonic
- Access to a proof server URL (to run one locally see `midnightntwrk/proof-server` on Docker Hub)

## Setup

**1. Install deps & build**

```bash
bun install
bun run --filter @capacity-exchange/midnight-core build
```

**2. Create a wallet mnemonic file**

```bash
echo "your mnemonic" > packages/midnight-node/wallet-mnemonic.preview.txt
```

**3. Create `.env`**

```bash
printf "WALLET_STATE_DIR=./.wallet-state\nPROOF_SERVER_URL=https://your-proof-server\n" > packages/midnight-node/.env
```

## Run

```bash
bun run --filter @capacity-exchange/midnight-node balances preview
```
