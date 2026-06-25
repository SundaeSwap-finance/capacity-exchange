# @sundaeswap/capacity-exchange-providers

## 3.0.0

### Major Changes

- df0e5d6: Registry stores bare domain names instead of IP+port; server URLs are resolved at connection time via DNS SRV records (`_capacityexchange._tcp.<domainName>`) using DNS-over-HTTPS.

  **Breaking changes — `@sundaeswap/capacity-exchange-registry`:**
  - `RegistryEntry.ip` and `RegistryEntry.port` removed; replaced by `RegistryEntry.domainName: DomainName`
  - `IpAddress`, `IPv4`, `IPv6`, `ContractIpAddress` types removed
  - `ipToContract` / `ipFromContract` removed; replaced by `domainNameToContract` / `domainNameFromContract`
  - `register` CLI argument changed from `<ip> <port>` to `<domainname>`
  - Contract redeployed for PREVIEW network: `takenSocketAddresses` → `takenDomainNames`; `Entry.ip`/`Entry.port` → `Entry.domainName`
  - Contract not redeployed for PREPROD network.
  - New exports: `DomainName`, `SrvName`, `SRV_SERVICE_PREFIX`, `toDomainName`, `toSrvName`

  **Breaking changes — `@sundaeswap/capacity-exchange-providers`:**
  - `fetchRegistryCesUrls` now resolves domain names via DoH SRV lookup instead of constructing URLs from stored IP+port

### Minor Changes

- 6b97231: Upgrade midnight dependencies to latest preprod versions.
  Fix import style to work on npm without bundling.

### Patch Changes

- 5a6ab4f: Add checking of offer against the expected quote
- d0ddfd8: Unshielded Token Offer
- Updated dependencies [6b97231]
- Updated dependencies [571226c]
- Updated dependencies [df0e5d6]
- Updated dependencies [d0ddfd8]
- Updated dependencies [94ec760]
  - @sundaeswap/capacity-exchange-core@1.3.0
  - @sundaeswap/capacity-exchange-registry@2.0.0
  - @sundaeswap/capacity-exchange-client@1.2.0

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
- Updated dependencies [8dfe09a]
- Updated dependencies [19de633]
- Updated dependencies [af592bf]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-registry@1.1.0
  - @sundaeswap/capacity-exchange-core@1.2.0

## 1.3.0

### Minor Changes

- 2027d29: Improve APIs for easier dApp integration.

### Patch Changes

- Updated dependencies [2027d29]
  - @sundaeswap/capacity-exchange-core@1.1.0
  - @sundaeswap/capacity-exchange-client@1.1.0

## 1.2.0

### Minor Changes

- f6407b1: Improve documentation for public API, and remove some required fields

## 1.1.0

### Minor Changes

- 0ce4581: Add React SDK.
