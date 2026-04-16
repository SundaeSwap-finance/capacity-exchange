# @capacity-exchange/registry

The registry is a contract, acting as a directory of capacity exchange servers. Each entry maps a server's secret key (hashed on-chain) to an entry: its IP address, port, and expiry. 

Servers must lock collateral to register, and gets refunded after deregistering. 

Entries expire after a configurable maximum period — expired entries can be removed by anyone to reclaim their collateral.

---

## Commands

Note: Each command requires a `NETWORK_ID` (`preview`, `preprod` or `mainnet`) environment variable and a wallet (from `wallet-mnemonic.preview.txt` or `wallet-mnemonic.mainnet.txt`) with unshielded NIGHT funds.

---

### `generate-secret`

Generates a random 64-byte secret key and writes it hex-encoded to a file. This secret key is hashed and used as a registry key to identify an entry. This is required to `deregister` or `renew-registration`, and losing it means the collateral can only be recovered after the entry expires.

```sh
NETWORK_ID=preview bun run generate-secret <outputFile>
```

**Arguments**

| Argument | Description |
|---|---|
| `outputFile` | Path to write the generated secret key (hex) to |

**Example**

```sh
NETWORK_ID=preview bun run generate-secret ./registryKey
```

---

### `deploy`

Deploys a new instance of the registry contract to the network. It also sets the required collateral amount and the maximum registration period that all future entries must respect.

```sh
NETWORK_ID=preview bun run deploy <collateral> [registrationPeriod]
```

**Arguments**

| Argument | Description |
|---|---|
| `collateral` | Required collateral amount (in tDUST) per registered entry |
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

Adds a server to the registry. The server's entry -- IP, port, and expiry -- a key derived from the secret key. The required collateral is locked in the contract and returned on deregistration. The `period` argument controls how long the entry is valid — it must not exceed the contract's `maximumRegistrationPeriod`.

```sh
NETWORK_ID=preview bun run register <contractAddress> <secretKeyFile> <ip> <port> [period]
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | Address of the registry contract |
| `secretKeyFile` | Path to the secret key file (output of `generate-secret`) |
| `ip` | Server IP address (IPv4 or IPv6) |
| `port` | Server port number |
| `period` | Registration period in days (default: 30) |

**Example**

```sh
NETWORK_ID=preview bun run register \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  192.168.1.1 \
  8080 \
  30
```

---

### `deregister`

Removes a server entry from the registry and refunds the collateral to the recipient address. Requires the secret key used when registering.

```sh
NETWORK_ID=preview bun run deregister <contractAddress> <secretKeyFile> <recipientAddress>
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | Address of the registry contract |
| `secretKeyFile` | Path to the secret key file used when registering |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |

**Example**

```sh
NETWORK_ID=preview bun run deregister \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `claim-expired`

Claims the collateral from an expired registry entry. No secret key is required — anyone can call this once an entry's expiry has passed.

```sh
NETWORK_ID=preview bun run claim-expired <contractAddress> <registryKey> <recipientAddress>
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | Address of the registry contract |
| `registryKey` | Hex-encoded 32-byte registry key of the expired entry (from `list-servers`) |
| `recipientAddress` | Bech32m unshielded address to receive the collateral refund |

**Example**

```sh
NETWORK_ID=preview bun run claim-expired \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

---

### `renew-registration`

Extends the expiry of an existing registry entry. The new expiry must be within the contract's `maximumRegistrationPeriod`.

```sh
NETWORK_ID=preview bun run renew-registration <contractAddress> <secretKeyFile> <period>
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | Address of the registry contract |
| `secretKeyFile` | Path to the secret key file used when registering |
| `period` | New registration period in days (e.g. `30`) |

**Example**

```sh
NETWORK_ID=preview bun run renew-registration \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  30
```

---

### `list-servers`

Returns all registered servers from the registry contract as JSON.

```sh
NETWORK_ID=preview bun run list-servers <contractAddress>
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | Address of the registry contract |

**Example**

```sh
NETWORK_ID=preview bun run list-servers \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d
```

**Output**

```json
{
  "080f88efc90226cb61600e5f1708794dbfe453360855e501201a1dead35e99ab": {
    "ip": { "kind": "ipv4", "address": "192.168.1.1" },
    "port": 8080,
    "expiry": "2026-04-16T00:00:00.000Z"
  }
}
```