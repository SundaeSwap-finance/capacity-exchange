# Capacity Exchange Server

This service lets users on the Midnight network spend assets (like ADA) to fund Midnight transactions. The DUST used to fund those transactions comes from the liquidity provider running this server; they are exchanging their excess capacity (extra DUST) for other assets.

## How it Works

### Two Wallets

Use two separate wallets:

1.  **Cold Wallet (NIGHT):** You keep your NIGHT in your own secure wallet (like Lace). This service **never** touches your NIGHT keys.
2.  **Hot Wallet (DUST):** The service manages its own DUST wallet. You delegate your NIGHT to that address to generate DUST.

### Handling Multiple Users

The service can handle multiple trades at once so long as you set up your NIGHT correctly.

- **One NIGHT UTXO = One DUST-generating UTXO.**
- If you have 10 separate NIGHT UTXOs delegated, the service has 10 DUST UTXOs to trade.
- **To handle more trades:** Split your NIGHT into more pieces (UTXOs) in your wallet.

### Trading (Offers)

- **Reservation:** When a user asks for DUST, the service "locks" the offered DUST.
- **Swaps:** The service creates an atomic swap tx that ensures DUST is only sent if the user pays the required ADA.

## Configuration

Price and sponsored contract configuration are defined in a JSON file (see `price-config.example.json` for a starting template).

```jsonc
{
  "priceFormulas": [],
  "sponsorAll": false,
  "sponsoredContracts": [],
}
```
###  Price Formulas

Price formulas are used to calculate the cost of speck for a given currency. For example, to charge a 0.2 ADA flat fee and 1.1 ADA per 1,000 DUST:

```jsonc
{
  "currency": "lovelace",
  "basePrice": "200000",        // 0.2 ADA = 2 * 10^5 lovelace
  "rateNumerator": "1100000",   // 1.1 ADA = 1.1 * 10^6 lovelace
  "rateDenominator": "1000000000000000000" // 1000 DUST = 10^18 specks
}
```

// TODO: This should be something like tokenId (determined by the Midnight contract) and displayName
- `currency`: The payment currency identifier.
- `basePrice`: A fixed base cost added to every price, in the smallest subunit of the currency.
- `rateNumerator` / `rateDenominator`: The per-speck rate, expressed as a fraction to avoid floating-point precision loss.

The formula is: `price = specks * rateNumerator / rateDenominator + basePrice`.

For example, using the above price formula, requesting 4321 DUST (4321 * 10^15 specks) yields the price:

```
price = 4321 DUST * (1.1 ADA / 1000 DUST) + 0.2 ADA
      = (4321 * 10^15 specks) * (1,100,000 lovelace / 10^18 specks) + 200,000 lovelace
      = 4,753,100 + 200,000 lovelace
      = 4,953,100 lovelace
```

### Sponsored Transactions

You can configure which transactions the service will sponsor (provide DUST for at no charge).

#### Sponsor all transactions

Set `sponsorAll` to `true` to sponsor every transaction submitted to the server, regardless of which contract or circuit it targets:

```jsonc
{
  "sponsorAll": true,
  "sponsoredContracts": []
}
```

#### Sponsor specific contracts

When `sponsorAll` is `false` (or omitted), only transactions targeting contracts in the `sponsoredContracts` allowlist are eligible:

```jsonc
{
  "sponsorAll": false,
  "sponsoredContracts": [
    {
      "contractAddress": "0000000000000000000000000000000000000000000000000000000000000000",
      "circuits": { "type": "all" }
    },
    {
      "contractAddress": "0000000000000000000000000000000000000000000000000000000000000001",
      "circuits": { "type": "subset", "circuitNames": ["trade", "deposit"] }
    }
  ]
}
```

In the above configuration, any circuit at the contractAddress `0000000000000000000000000000000000000000000000000000000000000000` would be eligible for sponsorship, while only the circuits with the names "trade" and "deposit" at `0000000000000000000000000000000000000000000000000000000000000001` would be eligible for sponsorship.

## API

### `GET /api/prices?specks=<specks>`

Lists the service's supported currencies and how much you'd pay in each for your requested amount of DUST.

All amounts are in **specks**, the atomic unit of DUST (1 DUST = 10^15 specks).

**Request:**

- `specks`: How many specks of DUST you want.

**Response:**

- `prices`: A list of available prices, one for each currency the service supports.
- `prices.amount`: How much currency you would pay for your requested DUST.
- `prices.currency`: The currency in which you would pay.

### `POST /api/offers`

Request an offer. You provide how many specks of DUST you want and the currency in which you want to pay.
The service responds with how much of that currency you must pay and the serialized transaction that you must merge and submit.

**Request:**

- `specks`: How many specks of DUST you want.
- `offerCurrency`: Which currency you would like to pay in.

**Response:**

- `offerId`: ID for this trade.
- `offerAmount`: How much currency you must pay.
- `offerCurrency`: The currency in which you must pay.
- `serializedTx`: The signed, proven transaction that must be merged with your TX.
- `expiresAt`: When this offer expires.

## Development

### Prerequisites

- Docker
- Node.js 22+

#### Generating a Test Wallet

To test the service, you will need a wallet seed (or mnemonic) that has
- been registered for DUST generation and
- has NIGHT UTxOs

You can use the `gen-test-wallet` script to creates a new wallet, register its DUST address, and fund it with NIGHT. This is possible on a devnet where you have control of the "genesis" seed (0{63}1).

```bash
./scripts/gen-test-wallet.sh <night_amount> <num_txs>
```

- `night_amount`: Amount of NIGHT to send per transaction
- `num_txs`: Number of transactions to send

The generated wallet seed is saved to `wallet-seed.hex`. Point `WALLET_SEED_FILE` at it in your `.env`, or for dev use, place a `wallet-mnemonic.{network}.txt` file at the project root (the server finds it automatically via walk-up resolution).

### Running E2E Tests

```bash
./scripts/run-e2e.sh
```
