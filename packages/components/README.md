# @capacity-exchange/components

Cardano wallet and deposit tooling for the Capacity Exchange.

## Setup

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|---|---|
| `CARDANO_NETWORK` | `mainnet`, `preprod`, or `preview` |
| `BLOCKFROST_PROJECT_ID` | Your Blockfrost project ID for the chosen network |

## CLI Commands

### cardano-wallet generate

Generate a new Cardano wallet.

```bash
npm run cardano-wallet -- generate --output ./seed.hex --mnemonic-out ./mnemonic.txt
```

### cardano-wallet restore

Restore a Cardano wallet from an existing mnemonic file.

```bash
npm run cardano-wallet -- restore --output ./seed.hex --mnemonic-in ./existing-mnemonic.txt
```

### cardano-wallet bridge-utxos

List bridge deposit UTXOs at a Cardano address.

```bash
npm run cardano-wallet -- bridge-utxos --address <bech32-address>
```

### cardano-wallet deposit-midnight

Deposit ADA to a Midnight shielded address via the deposit address.

```bash
npm run cardano-wallet -- deposit-midnight --mnemonic ./mnemonic.txt --deposit-address <deposit-address> --midnight-address <midnight-shielded-address> --lovelace <lovelace-amount>
```

## Testing end-to-end

1. Generate a wallet:
   ```bash
   npm run cardano-wallet -- generate --output ./seed.hex --mnemonic-out ./mnemonic.txt
   ```

2. Fund the address from the [Cardano testnet faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/).

3. Verify funds arrived:
   ```bash
   npm run cardano-wallet -- bridge-utxos --address <address>
   ```

4. Deposit to a Midnight address:
   ```bash
   npm run cardano-wallet -- deposit-midnight --mnemonic ./mnemonic.txt --deposit-address <deposit-address> --midnight-address <midnight-address> --lovelace 2000000
   ```
