# @sundaeswap/capacity-exchange-providers

Browser APIs for the Capacity Exchange.

To submit a transaction to the Midnight Blockchain, you need to pay for it in DUST. The Capacity Exchange lets users fund transactions without any DUST of their own. The `capacityExchangeWalletProvider` requires users to pay for this DUST with some other currency. The `sponsoredTransactionsWalletProvider` doesn't require users to pay at all.

If you are using React, consider using [@sundaeswap/capacity-exchange-react-sdk](https://www.npmjs.com/package/@sundaeswap/capacity-exchange-react-sdk) for an easier integration experience.

## Usage

For more complete example usage, see [our React example app](../../examples/react-vite/src/App.tsx).

```tsx
import {
  CurrencySelectionResult,
  ExchangePrice,
  Offer,
  OfferConfirmationResult,
  capacityExchangeWalletProvider,
  sponsoredTransactionsWalletProvider,
} from '@sundaeswap-capacity-exchange-providers';

async function chooseFirstCurrency(
  prices: ExchangePrice[],
  dustRequired: bigint,
  requestId: string,
): Promise<CurrencySelectionResult> {
  console.log(`${requestId}: we need ${dustRequired} dust`)
  for (const price of prices) {
  }
  if (prices.length) {
    const exchangePrice = prices[0];    
    console.log(`${requestId}: paying ${exchangePrice.price.amount} ${exchangePrice.price.currency}`);
    return { status: 'selected', exchangePrice };
  } else {
    return { status: 'cancelled' };
  }
}

async function alwaysConfirmOffer(
  offer: Offer,
  dustRequired: bigint,
  requestId: string,
): Promise<OfferConfirmationResult> {
  console.log(`${requestId}: confirming offer ${offer.offerId}`);
  return { status: 'confirmed' };
}

async function getWalletProvider(wallet: ConnectedAPI) {
  const [addresses, configuration] = await Promise.all([
    wallet.getShieldedAddresses(),
    wallet.getConfiguration(),
  ]);
  return capacityExchangeWalletProvider({
    networkId: configuration.networkId,
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    balanceUnsealedTransaction: wallet.balanceUnsealedTransaction,
    balanceSealedTransaction: wallet.balanceSealedTransaction,
    ledgerParametersProvider: () => getLedgerParameters(configuration.indexerUri),
    promptForCurrency: chooseFirstCurrency,
    confirmOffer: alwaysConfirmOffer,
  });
}

async function getSponsoredWalletProvider(wallet: ConnectedAPI) {
  const addresses = await wallet.getShieldedAddresses();
  return sponsoredTransactionsWalletProvider({
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    capacityExchangeUrl: 'https://capacity-exchange.my.dapp'
  });
}
```

## API

### `capacityExchangeWalletProvider(config)`

A function which gives you a `WalletProvider` backed by the Capacity Exchange. This provider balances Midnight transactions through the Capacity Exchange API; the user will pay with some other currency instead of DUST.

If you would like to provide DUST for user transactions yourself, consider the `sponsoredTransactionsWalletProvider` instead.

| Argument | Required | Description |
| --- | --- | --- |
| `config.networkId` | yes | The ID of the midnight network you're connecting to. Usually `preview`, `preprod`, or `mainnet`.
| `config.coinPublicKey` | yes | The `coinPublicKey` of the user's Shielded wallet. |
| `config.encryptionPublicKey` | yes | The `encryptionPublicKey` of the user's Shielded wallet. |
| `config.balanceUnsealedTransaction` | yes | A callback which can balance an unsealed transaction. You can pass `balanceUnsealedTransaction` from the user's wallet. |
| `config.balanceSealedTransaction` | yes | A callback which can balance a sealed transaction. You can pass `balanceSealedTransaction` from the user's wallet. |
| `config.ledgerParametersProvider` | yes | A callback which returns the chain's current `LedgerParameters`, used to estimate DUST speck cost. You can pass `() => getLedgerParameters(indexerUrl)` from `@sundaeswap/capacity-exchange-core`. |
| `config.additionalCapacityExchangeUrls` | no | The URLs for any additional Capacity Exchange servers to use. |
| `config.margin` | no | A safety margin in blocks, used when estimating fees. Defaults to `3`. |
| `config.promptForCurrency` | yes | A function called when the user must choose which currency to pay. |
| `config.confirmOffer` | yes | A function called when the user has received an offer and must confirm it's acceptable. |

#### `config.promptForCurrency(prices, dustRequired, requestId)`

This callback is called when the user must choose which currency to pay. It can return the following:
 - `{ status: 'selected', exchangePrice }`: The user will pay the given price.
 - `{ status: 'cancelled' }`: The user will not pay, and will not submit the transaction.

#### `config.confirmOffer(offer, dustRequired, requestId)`

This callback is called when the user must confirm a given offer. It can return the following:
 - `{ status: 'confirmed' }`: The user will accept the given offer.
 - `{ status: 'back' }`: The user will not accept the given offer, but would like to choose a different currency to pay with.
 - `{ status: 'cancelled' }`: The user will not accept the given offer, and will not submit the transaction.

### `sponsoredTransactionsWalletProvider(config)`

A function which gives you a `WalletProvider` used to "sponsor" transactions. These are transactions which a Capacity Exchange server funds for free.

To use this wallet provider, you will probably want to run your own server. See [the server documentation](../../apps/server/README.md) for more on that.

| Argument | Required | Description |
| --- | --- | --- |
| `config.coinPublicKey` | yes | The `coinPublicKey` of the user's Shielded wallet. |
| `config.encryptionPublicKey` | yes | The `encryptionPublicKey` of the user's Shielded wallet. |
| `config.capacityExchangeUrl` | yes | The URL to a Capacity Exchange server willing to fund this transaction. This will probably be run by the dApp developer.|