---
'@sundaeswap/capacity-exchange-nodejs': major
'@capacity-exchange/server': patch
'@capacity-exchange/tests': patch
---

Split `AppConfig` into `NetworkConfig` + `WalletConfig`. Replace `getAppConfigById` with pure builders (`buildAppConfig`, `buildNetworkConfig`, `buildWalletConfig`) that take an explicit `Env`, plus `resolveEnv()` for callers that want env-based composition. `AppContext.proofServerUrl` moves to `config.network.endpoints.proofServerUrl`. Rename CLI `seed-wallet-state` → `restore-from-chain-snapshot` with `--seed-file` / `--mnemonic-file` flags. Add `loadWalletSeedFromEnv(env)` (no walk-up).

Additional breaking changes:

- `buildWalletConfig` now requires `WALLET_STATE_DIR`; the prior `./.wallet-state-<network>` default is removed.
- `withAppContext` now takes an `AppConfig` (pure). Use the new `withAppContextFromEnv(networkId, fn)` wrapper for the previous env-based behavior.
- Added `createPublicDataProvider(network)` for read-only callers that need only a public data provider without wallet bootstrap.
