# Capacity Exchange

Client and server packages for the Capacity Exchange Service on the Midnight network. The Capacity Exchange is a service which can fund Midnight transactions for users who have no DUST of their own.

**For dApp developers**: See [packages/react-sdk/](packages/react-sdk/) or [packages/providers/](packages/providers/) to learn how to integrate this into your dApp.

## Local Dev Prerequisites

- [bun](https://bun.sh) (>= 1.1.0)
- [go-task](https://taskfile.dev) — command runner (`brew install go-task`)

## Available Tasks

Run `task --list` to see all tasks. Key ones:

| Task | Description |
|------|-------------|
| `test` | Run tests |
| `check` | Lint and format check |
| `fix` | Lint and format fix |
| `clean` | Clean build artifacts |

## Registering a Server to the Registry

Refer to the [registry package](packages/registry/README.md) for `registry` related commands.

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate, run `task regenerate-client`.

