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
| `registry:generate-secret` | Generate a registry secret key |
| `registry:register` | Register a server to the registry |
| `registry:renew` | Renew a server registration |
| `registry:deregister` | Deregister a server from the registry |
| `registry:list` | List all registered servers |

## Registering a Server to the Registry

All commands run from the project root using `task`.

### Prerequisites

- A deployed registry contract address(or deploy a new one — see [`deploy`](packages/registry/README.md#deploy)):
  - preview: `031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b`
  - preprod: `926e111d46992869775101830e4e75129606baee3b58056465f788922c48f42f`

- A wallet mnemonic file at `wallet-mnemonic.<NETWORK_ID>.txt` in the project root
- `NETWORK_ID` environment variable (e.g. `preview`)


### 1. Generate a secret key

```sh
NETWORK_ID=preview task registry:generate-secret -- secret-key.txt
```

This writes a 64-byte hex-encoded secret key to `secret-key.txt`. Keep this file — it is required for renewal and deregistration.

### 2. Register your server

```sh
NETWORK_ID=preview task registry:register -- 031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b secret-key.txt <ip> <port> [period]
```

| Argument | Description |
|---|---|
| `ip` | Your server's public IP address (IPv4 or IPv6) |
| `port` | Your server's port number |
| `period` | Registration period in days (default: 30) |

### 3. Verify registration

```sh
NETWORK_ID=preview task registry:list -- 031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b
```

Displays all registered servers with their IP, port, and expiry timestamp.

### 4. Renew registration

Renew before your registration expires to stay listed:

```sh
NETWORK_ID=preview task registry:renew -- 031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b secret-key.txt <period>
```

### 5. Deregister (optional)

Removes your server from the registry and refunds the collateral to a recipient address:

```sh
NETWORK_ID=preview task registry:deregister -- 031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b secret-key.txt <recipientAddress>
```

`recipientAddress` must be a Bech32m-encoded unshielded address.

---

## Generating the Client

The code in `packages/client/generated` is auto-generated from the server's OpenAPI spec. To regenerate, run `task regenerate-client`.

