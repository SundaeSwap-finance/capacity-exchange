---
'@sundaeswap/capacity-exchange-providers': major
'@sundaeswap/capacity-exchange-react-sdk': major
---

Replace `indexerUrl` in `CapacityExchangeConfig` with `publicDataProvider` and `ledgerParametersProvider`. The SDK now uses the caller-supplied `PublicDataProvider` to discover registered CES server URLs from the on-chain registry.
