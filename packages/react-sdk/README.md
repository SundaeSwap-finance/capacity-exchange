# @sundaeswap/capacity-exchange-react-sdk

Prebuilt components to quickly integrate your React Midnight dApp with the Capacity Exchange.

To submit a transaction to the Midnight Blockchain, you need to pay for it in DUST. The Capacity Exchange lets users fund transactions without any DUST of their own. The `useCapacityExchangeWalletProvider` hook requires users to pay for this DUST with some other currency. The `useSponsoredTransactionsWalletProvider` hook doesn't require users to pay at all.

If you are not using React, consider using [@sundaeswap/capacity-exchange-providers](https://www.npmjs.com/package/@sundaeswap/capacity-exchange-providers) directly instead.

## Usage

For more complete example usage, see [our React example app](../../examples/react-vite/src/App.tsx).

```tsx
import { use, useCallback, useMemo } from 'react';
import {
  CapacityExchangeRoot,
  useCapacityExchangeWalletProvider,
  useSponsoredTransactionsWalletProvider,
} from '@sundaeswap-capacity-exchange-react-sdk';

// Wrap your App in CapacityExchangeRoot
export function App() {
  return (
    <CapacityExchangeRoot>
      <MyApp />
    </CapacityExchangeRoot>
  );
}

function useWalletProvider(wallet: ConnectedAPI) {
  const walletDetailsPromise = useMemo(() => Promise.all([
    wallet.getShieldedAddresses(),
    wallet.getConfiguration(),
  ]), [wallet]);
  const [addresses, configuration] = use(walletDetailsPromise);
  return useCapacityExchangeWalletProvider({
    networkId: configuration.networkId,
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    balanceUnsealedTransaction: wallet.balanceUnsealedTransaction,
    balanceSealedTransaction: wallet.balanceSealedTransaction,
    ledgerParametersProvider: () => getLedgerParameters(configuration.indexerUri),
  });
}

export function MyApp() {
  const wallet: ConnectedAPI = useWallet();
  const walletProvider = useWalletProvider(wallet);

  // You can use this WalletProvider in most APIs which build transactions.
  const balanceTx = useCallback((tx: UnboundTransaction) => {
    const balancedTx = await walletProvider.balanceTx(tx);
    return balancedTx;
  }, [walletProvider]);
}

```

## API

### `CapacityExchangeRoot`

Wrap your application in <CapacityExchangeRoot>. Funding a transaction is an interactive process, and this displays the user interface for it.

| Property | Required | Description |
| --- | --- | --- |
| `PromptForCurrency` | no | Custom React component, shown when the user is choosing which currency to pay. |
| `WaitForOffer` | no | Custom React component, shown when the user is waiting for an offer to sponsor their transaction. |
| `ConfirmOffer` | no | Custom React component, shown when the user has received an offer and needs to confirm it's acceptable. |

#### Theming

The dialog UI is styled using CSS custom properties. You can override any of these on `:root` (or any ancestor element) to apply your own theme:

| Variable | Default (light / dark) | Description |
|---|---|---|
| `--ce-sdk-width` | `480px` | Maximum width of the dialog |
| `--ce-sdk-radius` | `12px` | Border radius of the dialog |
| `--ce-sdk-radius-sm` | `8px` | Border radius of inner elements (buttons, cards, etc.) |
| `--ce-sdk-font` | `'Geist', 'DM Sans', system-ui` | Font family |
| `--ce-sdk-mono` | `'DM Mono', ui-monospace` | Monospace font family, used for addresses and hex values |
| `--ce-sdk-color` | `#0B0514` / `#ffffff` | Primary text color |
| `--ce-sdk-bg` | `#ffffff` / `#160F22` | Dialog background color |
| `--ce-sdk-border` | `#DEDEE0` / `#3B3D49` | Border color |
| `--ce-sdk-muted` | `#65597C` / `#9B9CA2` | Secondary/muted text color |
| `--ce-sdk-subtle` | `#F6F6F7` / `#2B2438` | Subtle background color, used for detail cards |
| `--ce-sdk-accent` | `#4092E5` / `#3A85D0` | Primary accent/brand color |
| `--ce-sdk-accent-subtle` | `rgba(64,146,229,0.08)` | Accent color at low opacity, used for hover states |
| `--ce-sdk-accent-fg` | `#ffffff` | Text color used on top of the accent color |

Example:

```css
:root {
  --ce-sdk-accent: #a855f7;
  --ce-sdk-accent-subtle: rgba(168, 85, 247, 0.08);
  --ce-sdk-radius: 4px;
}
```

### `useCapacityExchangeWalletProvider(config)`

A React hook which gives you a `WalletProvider` backed by the Capacity Exchange. This provider balances Midnight transactions through the Capacity Exchange API; the user will pay with some other currency instead of DUST.

If you would like to provide DUST for user transactions yourself, consider the `useSponsoredTransactionsWalletProvider` instead.

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

### `useSponsoredTransactionsWalletProvider(config)`

A React hook which gives you a `WalletProvider` used to "sponsor" transactions. These are transactions which a Capacity Exchange server funds for free.

To use this wallet provider, you will probably want to run your own server. See [the server documentation](../../apps/server/README.md) for more on that.

| Argument | Required | Description |
| --- | --- | --- |
| `config.coinPublicKey` | yes | The `coinPublicKey` of the user's Shielded wallet. |
| `config.encryptionPublicKey` | yes | The `encryptionPublicKey` of the user's Shielded wallet. |
| `config.capacityExchangeUrl` | yes | The URL to a Capacity Exchange server willing to fund this transaction. This will probably be run by the dApp developer.|