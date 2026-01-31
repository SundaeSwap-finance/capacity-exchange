# Capacity Exchange SDK

This repo holds client packages related to the [Capacity Exchange Service](https://github.com/SundaeSwap-finance/capacity-exchange-server).

## Prerequisites

- Node.js
- [just](https://github.com/casey/just) - command runner (`brew install just`)
- `COMPACTC` environment variable pointing to the Compact compiler (pre-built binaries available in `tools/compactc`)

## Quick Start

```bash
npm install
just setup    # compile contracts, copy assets
just dev      # run dev server
```

## Project Structure

```
.
├── justfile                            # Task orchestration (calls into packages)
├── packages/
│   ├── client/
│   │   ├── openapi.json                # Capacity Exchange Service OpenAPI spec
│   │   ├── generated/                  # Auto-generated OpenAPI client code
│   │   └── tests/                      # Client tests
│   ├── components/                     # Frontend components package (uses the generated client)
│   └── example-webapp/                 # Example webapp (uses the components)
│       └── contracts/                  # Compact smart contracts
```

## Build System Philosophy

This project uses a **distributed build architecture**:

- **Each package is self-contained**: Packages define their own build/test/clean commands via npm scripts. They can be used independently.
- **`just` orchestrates**: The root `justfile` coordinates cross-package workflows (setup, dev server) by calling into package scripts.
- **`just` doesn't duplicate**: The justfile calls `npm run` commands rather than reimplementing package-specific logic.

This separation keeps packages portable while providing convenient top-level commands.

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
    npm run generate-client
    ```
