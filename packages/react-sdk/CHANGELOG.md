# @sundaeswap/capacity-exchange-react-sdk

## 2.0.1

### Patch Changes

- 571226c: Add bun-specific exports of uncompiled TS code

## 2.0.0

### Major Changes

- 76aa1ef: Replace `indexerUrl` in `CapacityExchangeConfig` with a single `chainStateProvider: ChainStateProvider` (exposes `queryContractState` + `getLedgerParameters`). The SDK uses `queryContractState` to discover registered CES server URLs from the on-chain registry and `getLedgerParameters` to estimate DUST speck cost.

### Minor Changes

- f0acfbc: re-enable sponsor fallback
  - `peerCurrencySelector.ts`: `createAutoSelectCurrency` picks the cheapest eligible offer by `offered/max` ratio across all configured currencies;
  - `peerPrice.ts`: `PeerPriceService` reads operator-configured `maxPrices` ceilings; gracefully disabled (null) when `peer.maxPrices` is absent
  - `peerOfferConfirmer.ts`: auto-confirms every offer below threshold
  - `cesWalletProvider.ts`: accepts a pre-built `PromptForCurrency`; selection strategy is wired by the plugin, not the builder
  - `ces-wallet-provider.ts`: peer fallback gracefully disabled when `PeerPriceService` is null; uses `indexerChainStateProvider` from providers package

### Patch Changes

- 9c5d7f2: Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
- Updated dependencies [76aa1ef]
- Updated dependencies [f0acfbc]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-providers@2.0.0

## 1.3.0

### Minor Changes

- 2027d29: Improve APIs for easier dApp integration.

### Patch Changes

- Updated dependencies [2027d29]
  - @sundaeswap/capacity-exchange-providers@1.3.0

## 1.2.0

### Minor Changes

- f6407b1: Improve documentation for public API, and remove some required fields

### Patch Changes

- Updated dependencies [f6407b1]
  - @sundaeswap/capacity-exchange-providers@1.2.0

## 1.1.0

### Minor Changes

- 0ce4581: Add React SDK.

### Patch Changes

- Updated dependencies [0ce4581]
  - @sundaeswap/capacity-exchange-providers@1.1.0
