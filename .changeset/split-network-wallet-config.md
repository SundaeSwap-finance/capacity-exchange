---
'@sundaeswap/capacity-exchange-nodejs': major
'@capacity-exchange/server': patch
'@capacity-exchange/tests': patch
---

Split `AppConfig` into `NetworkConfig` + `WalletConfig`. Replace `getAppConfigById` with `getAppConfigFromEnv` + pure builders (`buildAppConfig`, `buildNetworkConfig`, `buildWalletConfig`). `AppContext.proofServerUrl` moves to `config.network.endpoints.proofServerUrl`. Rename CLI `seed-wallet-state` → `restore-from-chain-snapshot` with `--seed-file` / `--mnemonic-file` flags. Add `loadWalletSeedFromEnv(env)` (no walk-up).
