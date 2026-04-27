---
'@sundaeswap/capacity-exchange-nodejs': major
'@capacity-exchange/server': patch
'@capacity-exchange/tests': patch
---

Split `AppConfig` into `NetworkConfig` + `WalletConfig`. Replace `getAppConfigById` with pure builders (`buildAppConfig`, `buildNetworkConfig`, `buildWalletConfig`) that take an explicit `Env`, plus `resolveEnv()` for env-based composition. `buildWalletConfig` now requires `WALLET_STATE_DIR` (previous `./.wallet-state-<network>` default removed). `AppContext.proofServerUrl` moves to `config.network.endpoints.proofServerUrl`. `withAppContext` now takes an `AppConfig`; use the new `withAppContextFromEnv(networkId, fn)` for the prior env-based behavior. Add `loadWalletSeedFromEnv(env)` (no walk-up) and `createPublicDataProvider(network)` for read-only callers. Rename CLI `seed-wallet-state` → `restore-from-chain-snapshot` with `--seed-file` / `--mnemonic-file` flags.
