# Capacity Exchange SDK

This repo holds client packages related to the [Capacity Exchange Service](https://github.com/SundaeSwap-finance/capacity-exchange-server).

## Prerequisites

- [bun](https://bun.sh)
- [go-task](https://taskfile.dev) - command runner (`brew install go-task`)
- `COMPACTC` environment variable pointing to the Compact compiler. To set it up:
  ```bash
  unzip tools/compactc/compactc_v0.28.0_aarch64-darwin.zip -d ~/compactc_v0.28.0
  export COMPACTC=~/compactc_v0.28.0/compactc
  ```

## Quick Start

```bash
task install                        # install dependencies
task setup NETWORK_ID=<network>     # compile contracts, copy assets, build, deploy
task dev                            # run dev server
```

## Project Structure

```
.
├── Taskfile.yml                        # Task orchestration (calls into packages)
├── packages/
│   ├── client/
│   │   ├── openapi.json                # Capacity Exchange Service OpenAPI spec
│   │   ├── generated/                  # Auto-generated OpenAPI client code
│   │   └── tests/                      # Client tests
│   ├── components/                     # Frontend components package (uses the generated client)
│   ├── core/                           # Shared core logic
│   └── example-webapp/                 # Example webapp (uses the components)
│       └── contracts/                  # Compact smart contracts
```

## Build System Philosophy

This project uses a **distributed build architecture**:

- **Each package is self-contained**: Packages define their own build/test/clean commands via bun scripts. They can be used independently.
- **`task` orchestrates**: The root `Taskfile.yml` coordinates cross-package workflows (setup, dev server) by calling into package scripts.
- **`task` doesn't duplicate**: The Taskfile calls `bun run` commands rather than reimplementing package-specific logic.

This separation keeps packages portable while providing convenient top-level commands.

## Available Tasks

| Task | Description |
|------|-------------|
| `task install` | Install dependencies |
| `task compile-contracts` | Compile Compact contracts |
| `task setup NETWORK_ID=<network>` | One-time setup: install deps, compile contracts, copy assets, build, and deploy |
| `task build` | Build all packages |
| `task dev` | Build components and run dev server |
| `task test` | Run tests |
| `task deploy NETWORK_ID=<network>` | Deploy all contracts for a network |
| `task check` | Lint and format check |
| `task fix` | Lint and format fix |
| `task clean` | Clean build artifacts |

## Generating the Client

The code in `packages/client/generated` is auto-generated from the Capacity Exchange Service's OpenAPI spec. To regenerate it:

1.  **Run the service:** Bring up the [Capacity Exchange Service](https://github.com/SundaeSwap-finance/capacity-exchange-server) locally.

2.  **Download the OpenAPI spec:** Save the latest spec from the service's json docs endpoint.

    ```bash
    curl http://localhost:3000/docs/json > packages/client/openapi.json
    ```

3.  **Generate the client code:** Go to `packages/client` and run the generate script.

    ```bash
    cd packages/client
    bun run generate-client
    ```
