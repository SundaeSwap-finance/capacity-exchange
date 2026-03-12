# Capacity Exchange SDK

Client and server packages for the Capacity Exchange Service on the Midnight network.

## Prerequisites

- [bun](https://bun.sh) (>= 1.1.0)
- [go-task](https://taskfile.dev) — command runner (`brew install go-task`)

## Quick Start

```bash
# One-time setup: install deps, compile contracts, build packages, deploy
NETWORK_ID=undeployed task setup

# Start both the server and webapp with hot-reload
NETWORK_ID=undeployed task dev
```

- Note, the Compact compiler (`compactc`) is bundled in `tools/compactc/` and extracted automatically during setup.
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

## Security Notes

You'll notice wallet credentials env vars like `VITE_SERVER_PREVIEW_MNEMONIC` in .env.example. These get baked into the `example-webapp` JS bundle via Vite. This is fine for a demo on a test network (preview, preprod), but `example-webapp` shouldn't be run in a production env or with creds that map to a real wallet.
