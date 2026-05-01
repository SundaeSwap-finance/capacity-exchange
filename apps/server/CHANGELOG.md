# @capacity-exchange/server

## 1.1.0

### Minor Changes

- f0acfbc: re-enable sponsor fallback
  - `peerCurrencySelector.ts`: `createAutoSelectCurrency` picks the cheapest eligible offer by `offered/max` ratio across all configured currencies;
  - `peerPrice.ts`: `PeerPriceService` reads operator-configured `maxPrices` ceilings; gracefully disabled (null) when `peer.maxPrices` is absent
  - `peerOfferConfirmer.ts`: auto-confirms every offer below threshold
  - `cesWalletProvider.ts`: accepts a pre-built `PromptForCurrency`; selection strategy is wired by the plugin, not the builder
  - `ces-wallet-provider.ts`: peer fallback gracefully disabled when `PeerPriceService` is null; uses `indexerChainStateProvider` from providers package

### Patch Changes

- 3ae76c4: Rename package to `@sundaeswap/capacity-exchange-nodejs`
- 64ef4d9: Split `AppConfig` into `NetworkConfig` + `WalletConfig`. Replace `getAppConfigById` with pure builders (`buildAppConfig`, `buildNetworkConfig`, `buildWalletConfig`) that take an explicit `Env`, plus `resolveEnv()` for env-based composition. `buildWalletConfig` now requires `WALLET_STATE_DIR` (previous `./.wallet-state-<network>` default removed). `AppContext.proofServerUrl` moves to `config.network.endpoints.proofServerUrl`. `withAppContext` now takes an `AppConfig`; use the new `withAppContextFromEnv(networkId, fn)` for the prior env-based behavior. Add `loadWalletSeedFromEnv(env)` (no walk-up) and `createPublicDataProvider(network)` for read-only callers. Rename CLI `seed-wallet-state` → `restore-from-chain-snapshot` with `--seed-file` / `--mnemonic-file` flags.
- 9c5d7f2: Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
- Updated dependencies [76aa1ef]
- Updated dependencies [da29c54]
- Updated dependencies [3ae76c4]
- Updated dependencies [19de633]
- Updated dependencies [f0acfbc]
- Updated dependencies [64ef4d9]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-providers@2.0.0
  - @sundaeswap/capacity-exchange-nodejs@2.0.0
  - @sundaeswap/capacity-exchange-core@1.2.0

## 1.0.3

### Patch Changes

- Updated dependencies [2027d29]
  - @sundaeswap/capacity-exchange-core@1.1.0
  - @sundaeswap/capacity-exchange-providers@1.3.0
  - @sundaeswap/capacity-exchange-nodejs@1.0.1

## 1.0.2

### Patch Changes

- f6407b1: Improve documentation for public API, and remove some required fields
- Updated dependencies [f6407b1]
  - @sundaeswap/capacity-exchange-providers@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [0ce4581]
  - @sundaeswap/capacity-exchange-providers@1.1.0
