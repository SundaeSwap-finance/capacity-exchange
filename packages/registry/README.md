# @sundaeswap/capacity-exchange-registry

The registry is a contract acting as a directory of capacity exchange servers. Each entry maps a server's secret key (hashed on-chain) to a server address (either an SRV record name or an explicit IP + port) and an expiry.

Servers must lock collateral to register, and get refunded after deregistering.

Entries expire after a configurable maximum period — expired entries can be removed by anyone to reclaim the collateral.

## Well-known registry addresses

For `preview` and `preprod`, the `contractAddress` argument is optional — the CLI defaults to the known deployed address for the network.

| Network | Address |
|---------|---------|
| `preview` | `43a4da0d4354555c6aad6accaa7eaa11d29d4ab3a0da22e524b0b0a20034c35b` |
| `preprod` | `93c3402590d28979a9278cb25bd1fb413fae9bb921ce8b6642d166b366e30188` |

Pass a contract address explicitly to target a different deployment (e.g. a locally deployed registry or a future `mainnet` deployment).

---

## Registering a Server to the Registry

**Prerequisites:**
- A wallet (`wallet-mnemonic.<NETWORK_ID>.txt` or `wallet-seed.<NETWORK_ID>.hex`) with unshielded NIGHT funds
- `NETWORK_ID` env var set to `preview`, `preprod`, or `mainnet`

1. [Generate a secret key](#generate-secret) — do this once and keep the file safe
2. [Register your server](#register)
3. [Verify registration](#list-servers)
4. [Renew registration](#renew-registration) — renew before your entry expires to stay listed
5. [Deregister your server](#deregister) — reclaims your collateral
6. [Claim expired registrations](#claim-expired) — anyone can clean up expired entries

---

## Commands

### `generate-secret`

Generates a random 64-byte secret key and writes it hex-encoded to a file. This secret key is hashed and used as a registry key to identify an entry. Keep it safe — it is required to `deregister` or `renew-registration`, and losing it means the collateral can only be recovered after the entry expires.

```sh
NETWORK_ID=preview bun run generate-secret <outputFile>
```

| Argument | Description |
|---|---|
| `outputFile` | Path to write the generated secret key (hex) to |

**Example**

```sh
NETWORK_ID=preview bun run generate-secret ./my-registry-key.hex
```

---

### `deploy`

Deploys a new instance of the registry contract. Sets the required collateral amount and the maximum registration period for all future entries.

```sh
NETWORK_ID=preview bun run deploy <collateral> [registrationPeriod]
```

| Argument | Description |
|---|---|
| `collateral` | Required collateral per registered entry (in specks) |
| `registrationPeriod` | Max registration period in days (default: 30) |

**Output**

```json
{
  "contractAddress": "3470c638...",
  "txHash": "95a41b5e...",
  "secretKey": "..."
}
```

---

### `register`

Adds a server to the registry. The server address is stored under a key derived from the secret key. The required collateral is locked and returned on deregistration.

Two address formats are supported:
- **SRV record** — clients resolve the DNS SRV record to find the current host and port. No `port` argument needed.
- **IP address** — an explicit IPv4 or IPv6 address and port stored directly on-chain.

```sh
NETWORK_ID=preview bun run register <secretKeyFile> <host> [port] [period] [contractAddress]
```

| Argument | Description |
|---|---|
| `secretKeyFile` | Path to the secret key file (output of `generate-secret`) |
| `host` | SRV record name (e.g. `_ces._tcp.example.com`), IPv4, or IPv6 address |
| `port` | Server port number — required for IP addresses, omit for SRV records |
| `period` | Registration period in days (default: 30 for mainnet, 0.5 for preview/preprod) |
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example — SRV record (recommended)**

```sh
NETWORK_ID=preview bun run register ./my-registry-key.hex _ces._tcp.sundae.fi
```

**Example — IP address**

```sh
NETWORK_ID=preview bun run register ./my-registry-key.hex 192.168.1.1 8080
```

---

### `deregister`

Removes a server entry from the registry and refunds the collateral to the recipient address. Requires the secret key used when registering.

```sh
NETWORK_ID=preview bun run deregister <secretKeyFile> <recipientAddress> [contractAddress]
```

| Argument | Description |
|---|---|
| `secretKeyFile` | Path to the secret key file used when registering |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example**

```sh
NETWORK_ID=preview bun run deregister \
  ./my-registry-key.hex \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `claim-expired`

Claims the collateral from an expired registry entry. No secret key is required — anyone can call this once an entry's expiry has passed.

```sh
NETWORK_ID=preview bun run claim-expired <registryKey> <recipientAddress> [contractAddress]
```

| Argument | Description |
|---|---|
| `registryKey` | Hex-encoded 32-byte registry key of the expired entry (from `list-servers`) |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example**

```sh
NETWORK_ID=preview bun run claim-expired \
  080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `renew-registration`

Extends the expiry of an existing registry entry. The new expiry must be within the contract's `maximumRegistrationPeriod`.

```sh
NETWORK_ID=preview bun run renew-registration <secretKeyFile> [period] [contractAddress]
```

| Argument | Description |
|---|---|
| `secretKeyFile` | Path to the secret key file used when registering |
| `period` | New registration period in days (default: 30 for mainnet, 0.5 for preview/preprod) |
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example**

```sh
NETWORK_ID=preview bun run renew-registration ./my-registry-key.hex
```

---

### `list-servers`

Returns all registered servers from the registry contract.

```sh
NETWORK_ID=preview bun run list-servers [contractAddress]
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example**

```sh
NETWORK_ID=preview bun run list-servers
```

**Example — explicit address**

```sh
NETWORK_ID=preview bun run list-servers \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d
```

**Output**

SRV record entry:
```
25d91723c63521a399fb5e232de27c2064fd5241d19df478c16cc4b52ff337a9: {
  "address": {
    "kind": "srv",
    "address": "_ces._tcp.sundae.fi"
  },
  "expiry": "2026-05-08T22:13:34.000Z"
},
```

IP address entry:
```
25d91723c63521a399fb5e232de27c2064fd5241d19df478c16cc4b52ff337a9: {
  "address": {
    "kind": "ip",
    "host": {
      "kind": "ipv4",
      "address": "192.168.0.1"
    },
    "port": 3000
  },
  "expiry": "2026-05-08T22:08:10.000Z"
},
```
