# Capacity Exchange Demo

A complete end-to-end demo of the Capacity Exchange.

## Quick Start

### 1. Get a funded wallet

You'll need a wallet mnemonic funded with tNIGHT on preview. Create one using the [Lace wallet](https://www.lace.io/) browser extension and fund it via the [preview faucet](https://faucet.preview.midnight.network/).

### 2. Setup

```bash
# One-time: install deps, compile contracts, build packages, deploy, generate price config
# Prompts for your wallet mnemonic on first run
NETWORK_ID=preview task setup:demo
```

### 3. Run

```bash
# Start capacity exchange server (port 3000) and webapp (port 5173) with hot-reload
NETWORK_ID=preview task dev:demo
```

You can also run them independently:

```bash
NETWORK_ID=preview task dev:server   # CES server only
NETWORK_ID=preview task dev:webapp   # webapp only
```

## What `task setup:demo` Does

1. **Prompts for wallet mnemonic** — saved to `wallet-mnemonic.preview.txt` at the project root
2. **Copies `.env.example` files** — creates `.env` for server, webapp, and contracts packages
3. **Installs dependencies** — `bun install`
4. **Compiles Compact contracts** — extracts the bundled compiler and compiles counter + token-mint
5. **Builds all packages** — midnight-core → midnight-node → client → providers → webapp + server
6. **Deploys contracts** — deploys to the Midnight preview network
7. **Generates price config** — creates `apps/server/price-config.preview.json` from deployed contract data

## Available Tasks

Run `task --list` to see all tasks. Key ones:

| Task | Description |
|------|-------------|
| `setup:demo` | One-time setup for demo: configure env, install, build, deploy |
| `dev:demo` | Start server and demo with hot-reload |
| `dev:server` | Start the server only |
| `dev:webapp` | Start the demo webapp only |
| `build:demo` | Build demo webapp, server, and demo contracts |
| `deploy` | Deploy contracts for a network |
| `compile-contracts` | Compile Compact contracts |
| `test` | Run tests |
| `check` | Lint and format check |
| `fix` | Lint and format fix |
| `clean` | Clean build artifacts |

All network-aware tasks require `NETWORK_ID=<network>` (e.g., `preview`, `undeployed`).

A demo build is network-agnostic: `dist/index.html` carries an `@@APP_CONFIG@@` placeholder, and every URL comes from the network's defaults in `packages/midnight-core/src/networks.ts`. Fill it for a network before serving the bundle:

```bash
bun run --filter @capacity-exchange/demo interpolate-index --network-id preview
```

The dev server fills the placeholder itself, from `NETWORK_ID` and the optional `CAPACITY_EXCHANGE_URL`, `PROOF_SERVER_URL` and `MOCK_DEMO_MODE` (see `apps/demo/.env.example`). So `PROOF_SERVER_URL` configures the server and the webapp alike.

## Project Structure

```
.
├── Taskfile.yml              # User-facing task orchestration
├── taskfiles/                # Internal task definitions
├── scripts/                  # Cross-package CLI tools
├── tools/                    # Bundled tooling (Compact compiler)
├── apps/                     # Applications
│   ├── demo/                 # Demo webapp + Compact contracts
│   └── server/               # CES server
├── packages/
│   ├── midnight-core/        # Shared core logic
│   ├── midnight-node/        # Node-side Midnight integrations
│   ├── client/               # Auto-generated OpenAPI client
│   └── providers/            # CES providers to integrate into dApps
```

## External Services

The demo webapp setup (preview) depends on these services:

| Service | Endpoint | Setup Required? |
|---------|----------|-----------------|
| Proof server | `https://lace-proof-pub.preview.midnight.network` | No — public endpoint (preview) |
| Midnight node | `wss://rpc.preview.midnight.network/ws` | No — public endpoint |
| Midnight indexer | `https://indexer.preview.midnight.network/api/v3/graphql` | No — public endpoint |

For other networks (preprod, mainnet), you must provide your own proof server via `MIDNIGHT_PROOF_SERVER_URL` in the server's `.env`. Network endpoints are configured in `packages/midnight-core/src/networks.ts`.

## Wallet Configuration

All packages resolve the wallet mnemonic from a shared file at the project root:

```
wallet-mnemonic.{network}.txt   # e.g. wallet-mnemonic.preview.txt
```

`task setup:demo` prompts for your mnemonic and creates this file. Each package finds it by walking up the directory tree from its working directory, so you only configure it once.

In production (mainnet), set the server's `MIDNIGHT_WALLET_MNEMONIC_FILE` or `MIDNIGHT_WALLET_SEED_FILE` explicitly instead — the walk-up fallback is disabled on mainnet.

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate, run `task regenerate-client`.
