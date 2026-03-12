# Capacity Exchange SDK

Client and server packages for the Capacity Exchange Service on the Midnight network.

## Prerequisites

- [bun](https://bun.sh) (>= 1.1.0)
- [go-task](https://taskfile.dev) — command runner (`brew install go-task`)

## Quick Start

### 1. Get a funded wallet

You'll need a wallet mnemonic funded with tNIGHT on preprod. You can create one using the [Lace wallet](https://www.lace.io/) browser extension and fund it via the [preprod faucet](https://faucet.preprod.midnight.network/).

### 2. Setup and run

```bash
# One-time setup: install, compile, build, deploy (prompts for your mnemonic)
NETWORK_ID=preprod task setup

# Start server and webapp with hot-reload
NETWORK_ID=preprod task dev
```

- The Compact compiler is bundled in `tools/compactc/` and extracted automatically.
- Run `task --list` to see all available tasks.

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate it:

1.  **Run the server:** Start `packages/server` locally (e.g., `NETWORK_ID=preview task dev:server`).

2.  **Download the OpenAPI spec:** Save the latest spec from the server's json docs endpoint.

    ```bash
    curl http://localhost:3000/docs/json > packages/client/openapi.json
    ```

3.  **Generate the client code:** Go to `packages/client` and run the generate script.

    ```bash
    cd packages/client
    bun run generate-client
    ```

## Project Structure

```
.
├── Taskfile.yml                        # User-facing task orchestration
├── taskfiles/
│   ├── build.yml                       # Internal: TypeScript package build graph
│   └── contracts.yml                   # Internal: Compact contract compilation and deploy
├── tools/
│   └── compactc/                       # Bundled Compact compiler (auto-extracted)
├── packages/
│   ├── client/                         # Auto-generated OpenAPI client
│   ├── midnight-core/                  # Shared core logic
│   ├── midnight-node/                  # Node-side Midnight integrations
│   ├── components/                     # High-level Capacity Exchange Service (CES) components 
│   ├── server/                         # The CES server
│   ├── example-webapp/                 # Example CES webapp--illustrates using the CES components
│   │   └── contracts/                  # Example compact contracts--drive the example webapp
│   ├── bridge-contracts/               # Bridge compact contracts
│   └── bridge-webapp/                  # Bridge webapp
```

## Wallet Configuration

All packages resolve the wallet mnemonic from a shared file at the project root:

```
wallet-mnemonic.{network}.txt   # e.g. wallet-mnemonic.preprod.txt
```

`task setup` prompts for your mnemonic and creates this file. Each package finds it by walking up the directory tree from its working directory, so you only configure it once.

In production (mainnet), set `WALLET_MNEMONIC_FILE` or `WALLET_SEED_FILE` explicitly instead — the walk-up fallback is disabled on mainnet.

## Security Notes

The `example-webapp` reads the wallet mnemonic at build time and bakes it into the JS bundle via Vite (`VITE_SERVER_MNEMONIC`). This is fine for a demo on a test network (preprod), but `example-webapp` shouldn't be run in a production env or with credentials that map to a real wallet.
