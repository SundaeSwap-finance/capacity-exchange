# @capacity-exchange/registry

Contains the registry contract on the Midnight network.

---

## Commands

Note: Each command requires a `NETWORK_ID` (`preview` or `mainnet`) environment variable and a wallet (from `wallet-mnemonic.preview.txt` or `wallet-mnemonic.mainnet.txt`) with unshielded NIGHT funds.

--

### `generate-secret`

Generates random 64-byte secret key and writes to file. Acts as the registry key, authorizing `register`, `deregister`, and `refresh-validity` operations.

```sh
NETWORK_ID=preview bun run generate-secret <outputFile>
```

-- 

### `deploy`

Deploys a new registry contract. Outputs the contract address, transaction hash, generated secret key, and private state ID to stdout — save these for use with the other commands.

```sh
NETWORK_ID=preview bun run deploy <collateral> [validityInterval]
```

**Arguments**

| Argument | Description |
|---|---|
| `collateral` | Required collateral amount (in tDUST) per registered entry |
| `validityInterval` | Max validity interval in seconds (default: 30 days) |

**Output**

```json
{
  "contractAddress": "3470c638...",
  "txHash": "95a41b5e...",
  "secretKey": "...",
  "privateStateId": "..."
}
```

-- 

### `register`

Registers a server entry in the registry contract. Requires collateral.  
The entry contains the server's IP address, port, and validity expiry.

```sh
NETWORK_ID=preview bun run register <contractAddress> <secretKeyFile> <entryDetailsFile> [--private-state-id <id>]
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | address of the registry contract |
| `secretKeyFile` | Path to the registry key file (the outputFile of `generate-secret`) |
| `entryDetailsFile` | Path to a JSON file with the entry details (see below) |

**Options**

| Option | Description |
|---|---|
| `--private-state-id <id>` | defaults to a random hex string |

**Entry details JSON**

```json
{
  "ip": "192.168.0.1",
  "port": 8080,
  "validTo": "1776297600"
}
```

- `ip` — IPv4 or IPv6 address
- `port`
- `validTo` — Unix timestamp in seconds (must be within the contract's `maximumValidityInterval`)

**Example**

```sh
NETWORK_ID=preview bun run register \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  ./entry.json
```

--  

### `deregister`

Removes a server entry from the registry and refunds the collateral to the recipient address.

```sh
NETWORK_ID=preview bun run deregister <contractAddress> <secretKeyFile> <recipientAddress> [--private-state-id <id>]
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | address of the registry contract |
| `secretKeyFile` | Path to the registry key file used when registering |
| `recipientAddress` | Bech32m unshielded address |

**Options**

| Option | Description |
|---|---|
| `--private-state-id <id>` | defaults to a random hex string |

**Example**

```sh
NETWORK_ID=preview bun run deregister \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  mn_addr_preview1h8g8wxpyyj3pad65qysndyx5u2wmz5j7ma6dmstd5rmrnqwhkekqh2rs58
```

-- 

### `refresh-validity`

Extends the validity of an existing registry entry. The new expiry must be within the contract's `maximumValidityInterval`.

```sh
NETWORK_ID=preview bun run refresh-validity <contractAddress> <secretKeyFile> <validTo> [--private-state-id <id>]
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | On-chain address of the registry contract |
| `secretKeyFile` | Path to the registry key file used when registering |
| `validTo` | New expiry as a Unix timestamp in seconds (e.g. `1776297600`) |

**Options**

| Option | Description |
|---|---|
| `--private-state-id <id>` | defaults to a random hex string |

**Example**

```sh
NETWORK_ID=preview bun run refresh-validity \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d \
  ./registryKey \
  1776297600
```

--  

### `list-servers`

Returns a list of registered servers from the registry contract.

```sh
NETWORK_ID=preview bun run list-servers <contractAddress>
```

**Arguments**

| Argument | Description |
|---|---|
| `contractAddress` | address of the registry contract |

**Example**

```sh
NETWORK_ID=preview bun run list-servers \
  3470c638fca45245a3fd790ba68b24a42fce3c8145584eef8447cc23443bba4d
```

**Output**

```json
{
  "dabdf14e23bc3e770810ad1f911e68a02f7572a2098da7b9463a150b613a70e4": {
    "ip": { "kind": "ipv4", "address": "192.168.0.1" },
    "port": 8080,
    "validTo": "2026-04-14T00:00:00.000Z"
  }
}
```