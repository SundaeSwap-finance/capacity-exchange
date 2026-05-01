# @sundaeswap/capacity-exchange-registry

The registry is a contract acting as a directory of capacity exchange servers. Each entry maps a server's secret key (hashed on-chain) to an entry: its IP address, port, and expiry.

Servers must lock collateral to register, and get refunded after deregistering.

Entries expire after a configurable maximum period — expired entries can be removed by anyone to reclaim the collateral.

## Well-known registry addresses

For `preview` and `preprod`, the `contractAddress` argument is optional — the CLI defaults to the known deployed address for the network.

| Network | Address |
|---------|---------|
| `preview` | `2f825f8a4a1b92f5ffcab802f5a514d89844f776d55244fedf0ba383aafce0b7` |
| `preprod` | `926e111d46992869775101830e4e75129606baee3b58056465f788922c48f42f` |

Pass a contract address explicitly to target a different deployment (e.g. a locally deployed registry or a future `mainnet` deployment).

---

## Registering a Server to the Registry

**Prerequisites:**
- A wallet (`wallet-mnemonic.<NETWORK_ID>.txt` or `wallet-seed.<NETWORK_ID>.hex`) with unshielded NIGHT funds
- `NETWORK_ID` env var set to `preview`, `preprod`, or `mainnet`. 


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
# From this package
NETWORK_ID=preview bun run generate-secret <outputFile>

# From the repo root
NETWORK_ID=preview task registry:generate-secret -- <outputFile>
```

| Argument | Description |
|---|---|
| `outputFile` | Path to write the generated secret key (hex) to |

**Example**

```sh
# From this package
NETWORK_ID=preview bun run generate-secret ./my-registry-key.hex

# From the repo root
NETWORK_ID=preview task registry:generate-secret -- ./my-registry-key.hex
```

---

### `deploy`

Deploys a new instance of the registry contract. Sets the required collateral amount and the maximum registration period for all future entries.

```sh
# From this package
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

Adds a server to the registry. The entry — IP, port, and expiry — is stored under a key derived from the secret key. The required collateral is locked and returned on deregistration.

```sh
# From this package
NETWORK_ID=preview bun run register [contractAddress] <secretKeyFile> <ip> <port> [period]

# From the repo root
NETWORK_ID=preview task registry:register -- [contractAddress] <secretKeyFile> <ip> <port> [period]
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |
| `secretKeyFile` | Path to the secret key file (output of `generate-secret`) |
| `ip` | Server IP address (IPv4 or IPv6) |
| `port` | Server port number |
| `period` | Registration period in days (default: 30) |

**Example — preview (uses default address)**

```sh
# From this package
NETWORK_ID=preview bun run register ./my-registry-key.hex 192.168.1.1 8080 30

# From the repo root
NETWORK_ID=preview task registry:register -- ./my-registry-key.hex 192.168.1.1 8080 30
```

**Example — explicit address**

```sh
# From this package
NETWORK_ID=preview bun run register \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./my-registry-key.hex \
  192.168.1.1 8080 30

# From the repo root
NETWORK_ID=preview task registry:register -- \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./my-registry-key.hex \
  192.168.1.1 8080 30
```

---

### `deregister`

Removes a server entry from the registry and refunds the collateral to the recipient address. Requires the secret key used when registering.

```sh
# From this package
NETWORK_ID=preview bun run deregister [contractAddress] <secretKeyFile> <recipientAddress>

# From the repo root
NETWORK_ID=preview task registry:deregister -- [contractAddress] <secretKeyFile> <recipientAddress>
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |
| `secretKeyFile` | Path to the secret key file used when registering |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |

**Example — preview (uses default address)**

```sh
# From this package
NETWORK_ID=preview bun run deregister \
  ./my-registry-key.hex \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58

# from the repo root  
NETWORK_ID=preview task registry:deregister -- \
  ./my-registry-key.hex \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `claim-expired`

Claims the collateral from an expired registry entry. No secret key is required — anyone can call this once an entry's expiry has passed.

```sh
# From this package
NETWORK_ID=preview bun run claim-expired [contractAddress] <registryKey> <recipientAddress>

# From the repo root
NETWORK_ID=preview task registry:claim-expired -- [contractAddress] <registryKey> <recipientAddress>
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |
| `registryKey` | Hex-encoded 32-byte registry key of the expired entry (from `list-servers`) |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |

**Example — preview (uses default address)**

```sh
# From this package
NETWORK_ID=preview bun run claim-expired \
  080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58

# From the repo root
NETWORK_ID=preview task registry:claim-expired -- \
  080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `renew-registration`

Extends the expiry of an existing registry entry. The new expiry must be within the contract's `maximumRegistrationPeriod`.

```sh
# From this package
NETWORK_ID=preview bun run renew-registration [contractAddress] <secretKeyFile> <period>

# From the repo root
NETWORK_ID=preview task registry:renew -- [contractAddress] <secretKeyFile> <period>
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |
| `secretKeyFile` | Path to the secret key file used when registering |
| `period` | New registration period in days (e.g. `30`) |

**Example — preview (uses default address)**

```sh
# From this package
NETWORK_ID=preview bun run renew-registration ./my-registry-key.hex 30

# From the repo root
NETWORK_ID=preview task registry:renew -- ./my-registry-key.hex 30
```

---

### `list-servers`

Returns all registered servers from the registry contract.

```sh
# From this package
NETWORK_ID=preview bun run list-servers [contractAddress]

# From the repo root
NETWORK_ID=preview task registry:list -- [contractAddress]
```

| Argument | Description |
|---|---|
| `contractAddress` | Registry contract address (defaults to well-known address for network) |

**Example — preview (uses default address)**

```sh
# From this package
NETWORK_ID=preview bun run list-servers

# From the repo root
NETWORK_ID=preview task registry:list
```

**Example — explicit address**

```sh
# From this package
NETWORK_ID=preview bun run list-servers \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d

# From the repo root
NETWORK_ID=preview task registry:list -- \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d
```

**Output**

```
080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab: {
  "ip": { "kind": "ipv4", "address": "192.168.1.1" },
  "port": 8080,
  "expiry": "2026-04-16T00:00:00.000Z"
},
```
