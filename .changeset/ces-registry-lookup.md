---
'@sundaeswap/capacity-exchange-providers': major
'@sundaeswap/capacity-exchange-react-sdk': major
---

Replace `indexerUrl` in `CapacityExchangeConfig` with a single `chainStateProvider: ChainStateProvider` (exposes `queryContractState` + `getLedgerParameters`). The SDK uses `queryContractState` to discover registered CES server URLs from the on-chain registry and `getLedgerParameters` to estimate DUST speck cost.
