# Capacity Exchange SDK

Client and server packages for the Capacity Exchange Service on the Midnight network.

## Prerequisites

- [bun](https://bun.sh)
- [go-task](https://taskfile.dev) - command runner (`brew install go-task`)
- `COMPACTC` environment variable pointing to the Compact compiler (needed for setup only). To set it up:
  ```bash
  unzip tools/compactc/compactc_v0.28.0_aarch64-darwin.zip -d ~/compactc_v0.28.0
  export COMPACTC=~/compactc_v0.28.0/compactc
  ```

## Quick Start

```bash
# One-time setup: compile contracts, build all packages, deploy
COMPACTC=~/compactc_v0.28.0/compactc task setup NETWORK_ID=<network>

# Start both the server and webapp with hot-reload
NETWORK_ID=<network> task dev
```

## Project Structure

```
.
├── Taskfile.yml                        # Task orchestration (calls into packages)
├── packages/
│   ├── client/                         # Auto-generated OpenAPI client
│   ├── core/                           # Shared core logic
│   ├── components/                     # Shared adapters and integrations (depends on core, client)
│   ├── server/                         # Capacity exchange server (depends on core)
│   └── example-webapp/                 # Example webapp (depends on core, client, components)
│       └── contracts/                  # Compact smart contracts
```

### Workspace Dependency Graph

```
core        (no workspace deps)
client      (no workspace deps)
components  → core, client
server      → core
example-webapp → core, client, components, compiled contracts
```

## Available Tasks

| Task | Description |
|------|-------------|
| `NETWORK_ID=<network> task setup` | One-time setup: install, build everything, deploy contracts |
| `NETWORK_ID=<network> task dev` | Start server and webapp with hot-reload (requires setup) |
| `NETWORK_ID=<network> task dev:server` | Start just the capacity exchange server with hot-reload |
| `NETWORK_ID=<network> task dev:webapp` | Start just the example webapp with hot-reload (requires setup) |
| `task build-all` | Typecheck all TypeScript packages (requires compiled contracts) |
| `NETWORK_ID=<network> task build` | Full build: compile contracts, copy ZK assets, build everything |
| `task compile-contracts` | Compile Compact contracts (requires `COMPACTC`) |
| `NETWORK_ID=<network> task deploy` | Deploy contracts for a network |
| `task test` | Build libs and run tests |
| `task check` | Lint and format check |
| `task fix` | Lint and format fix |
| `task clean` | Clean all build artifacts and node_modules |

## Security Notes

Because of the way Vite env vars work, the `VITE_SERVER_*` wallet credentials get baked into the `example-webapp` JS bundle. This is fine for a demo on a test network (preview, preprod), but `example-webapp` shouldn't be run in a production env or with creds that map to a real wallet.

## Build System Philosophy

This project uses a **distributed build architecture**:

- **Each package is self-contained**: Packages define their own build/test/clean commands via bun scripts. They can be used independently.
- **`task` orchestrates**: The root `Taskfile.yml` coordinates cross-package workflows (setup, dev server) by calling into package scripts.
- **`task` doesn't duplicate**: The Taskfile calls `bun run` commands rather than reimplementing package-specific logic.
- **`task` models the dependency graph**: Build tasks mirror the workspace dependency graph so packages build in the correct order.
- **`dev` includes hot-reload**: The dev tasks run `tsc --watch` for library packages so changes to core or components automatically rebuild and restart the dev servers.

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
