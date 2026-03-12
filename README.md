# Capacity Exchange SDK

Client and server packages for the Capacity Exchange Service on the Midnight network.

## Prerequisites

- [bun](https://bun.sh) (>= 1.1.0)
- [go-task](https://taskfile.dev) — command runner (`brew install go-task`)
- A running [proof server](https://docs.midnight.network) at `http://127.0.0.1:6300`

## Quick Start

### 1. Get a funded wallet

You'll need a wallet mnemonic funded with tNIGHT on preprod. Create one using the [Lace wallet](https://www.lace.io/) browser extension and fund it via the [preprod faucet](https://faucet.preprod.midnight.network/).

### 2. Setup

```bash
# One-time: install deps, compile contracts, build packages, deploy, generate price config
# Prompts for your wallet mnemonic on first run
NETWORK_ID=preprod task setup
```

### 3. Run

```bash
# Start capacity exchange server (port 3000) and webapp (port 5173) with hot-reload
NETWORK_ID=preprod task dev
```

You can also run them independently:

```bash
NETWORK_ID=preprod task dev:server   # CES server only
NETWORK_ID=preprod task dev:webapp   # webapp only
```

## What `task setup` Does

1. **Prompts for wallet mnemonic** — saved to `wallet-mnemonic.preprod.txt` at the project root
2. **Copies `.env.example` files** — creates `.env` for server, webapp, and contracts packages
3. **Installs dependencies** — `bun install`
4. **Compiles Compact contracts** — extracts the bundled compiler and compiles counter + token-mint
5. **Builds all packages** — midnight-core → midnight-node → client → components → webapp + server
6. **Deploys contracts** — deploys to the Midnight preprod network (requires a proof server)
7. **Generates price config** — creates `packages/server/price-config.preprod.json` from deployed contract data

## Available Tasks

Run `task --list` to see all tasks. Key ones:

| Task | Description |
|------|-------------|
| `setup` | One-time setup: configure env, install, build, deploy |
| `dev` | Start server and webapp with hot-reload |
| `dev:server` | Start the server only |
| `dev:webapp` | Start the webapp only |
| `build` | Build all packages and compile/copy contracts |
| `deploy` | Deploy contracts for a network |
| `compile-contracts` | Compile Compact contracts |
| `test` | Run tests |
| `check` | Lint and format check |
| `fix` | Lint and format fix |
| `clean` | Clean build artifacts |

All network-aware tasks require `NETWORK_ID=<network>` (e.g., `preprod`, `undeployed`).

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

## Wallet Configuration

All packages resolve the wallet mnemonic from a shared file at the project root:

```
wallet-mnemonic.{network}.txt   # e.g. wallet-mnemonic.preprod.txt
```

`task setup` prompts for your mnemonic and creates this file. Each package finds it by walking up the directory tree from its working directory, so you only configure it once.

In production (mainnet), set `WALLET_MNEMONIC_FILE` or `WALLET_SEED_FILE` explicitly instead — the walk-up fallback is disabled on mainnet.

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate:

1. Start the server: `NETWORK_ID=preprod task dev:server`
2. Download the spec: `curl http://localhost:3000/docs/json > packages/client/openapi.json`
3. Generate: `cd packages/client && bun run generate-client`

## Security Notes

The `example-webapp` reads the wallet mnemonic at build time and bakes it into the JS bundle via Vite (`VITE_SERVER_MNEMONIC`). This is fine for a demo on a test network but should not be used in production or with a real wallet.
