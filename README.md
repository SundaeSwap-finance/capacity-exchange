# Capacity Exchange SDK

Client and server packages for the Capacity Exchange Service on the Midnight network.

## Prerequisites

- [bun](https://bun.sh) (>= 1.1.0)
- [go-task](https://taskfile.dev) — command runner (`brew install go-task`)

## Quick Start

### 1. Get a funded wallet

You'll need a wallet mnemonic funded with tNIGHT on preview. Create one using the [Lace wallet](https://www.lace.io/) browser extension and fund it via the [preview faucet](https://faucet.preview.midnight.network/).

### 2. Setup

```bash
# One-time: install deps, compile contracts, build packages, deploy, generate price config
# Prompts for your wallet mnemonic on first run
NETWORK_ID=preview task setup:example
```

### 3. Run

```bash
# Start capacity exchange server (port 3000) and webapp (port 5173) with hot-reload
NETWORK_ID=preview task dev:example
```

You can also run them independently:

```bash
NETWORK_ID=preview task dev:server   # CES server only
NETWORK_ID=preview task dev:webapp   # webapp only
```

## What `task setup:example` Does

1. **Prompts for wallet mnemonic** — saved to `wallet-mnemonic.preview.txt` at the project root
2. **Copies `.env.example` files** — creates `.env` for server, webapp, and contracts packages
3. **Installs dependencies** — `bun install`
4. **Compiles Compact contracts** — extracts the bundled compiler and compiles counter + token-mint
5. **Builds all packages** — midnight-core → midnight-node → client → components → webapp + server
6. **Deploys contracts** — deploys to the Midnight preview network
7. **Generates price config** — creates `packages/server/price-config.preview.json` from deployed contract data

## Available Tasks

Run `task --list` to see all tasks. Key ones:

| Task | Description |
|------|-------------|
| `setup:example` | One-time setup for example webapp: configure env, install, build, deploy |
| `dev:example` | Start server and example webapp with hot-reload |
| `dev:server` | Start the server only |
| `dev:webapp` | Start the webapp only |
| `build:example` | Build example webapp, server, and example contracts |
| `deploy` | Deploy contracts for a network |
| `compile-contracts` | Compile Compact contracts |
| `test` | Run tests |
| `check` | Lint and format check |
| `fix` | Lint and format fix |
| `clean` | Clean build artifacts |

All network-aware tasks require `NETWORK_ID=<network>` (e.g., `preview`, `undeployed`).

## Project Structure

```
.
├── Taskfile.yml              # User-facing task orchestration
├── taskfiles/                # Internal task definitions
├── scripts/                  # Cross-package CLI tools
├── tools/                    # Bundled tooling (Compact compiler)
├── packages/
│   ├── midnight-core/        # Shared core logic
│   ├── midnight-node/        # Node-side Midnight integrations
│   ├── client/               # Auto-generated OpenAPI client
│   ├── components/           # High-level CES components
│   ├── server/               # CES server
│   ├── example-webapp/       # Example CES webapp + Compact contracts
│   ├── bridge-contracts/     # Bridge Compact contracts
│   └── bridge-webapp/        # Bridge webapp
```

## External Services

The example webapp setup (preview) depends on these services:

| Service | Endpoint | Setup Required? |
|---------|----------|-----------------|
| Proof server | `https://lace-proof-pub.preview.midnight.network` | No — public endpoint (preview) |
| Midnight node | `wss://rpc.preview.midnight.network/ws` | No — public endpoint |
| Midnight indexer | `https://indexer.preview.midnight.network/api/v3/graphql` | No — public endpoint |

For other networks (preprod, mainnet), you must provide your own proof server via `PROOF_SERVER_URL` in the server's `.env`. Network endpoints are configured in `packages/midnight-core/src/networks.ts`.

The bridge webapp additionally requires a [Blockfrost](https://blockfrost.io/) API key (`VITE_BLOCKFROST_PROJECT_ID`). After running the rest of setup, you should provide this in `packages/bridge-contracts/.env.example`.

## Wallet Configuration

All packages resolve the wallet mnemonic from a shared file at the project root:

```
wallet-mnemonic.{network}.txt   # e.g. wallet-mnemonic.preview.txt
```

`task setup:example` prompts for your mnemonic and creates this file. Each package finds it by walking up the directory tree from its working directory, so you only configure it once.

In production (mainnet), set `WALLET_MNEMONIC_FILE` or `WALLET_SEED_FILE` explicitly instead — the walk-up fallback is disabled on mainnet.

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate, run `task regenerate-client`.

## Security Notes

The `example-webapp` reads the wallet mnemonic at build time and bakes it into the JS bundle via Vite (`VITE_SERVER_MNEMONIC`). This is fine for a demo on a test network but should not be used in production or with a real wallet.
