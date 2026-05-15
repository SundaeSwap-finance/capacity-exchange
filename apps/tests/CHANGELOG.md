# @capacity-exchange/tests

## 1.0.2

### Patch Changes

- da29c54: Converge env reads behind `resolveEnv()` + `requireEnvVar(env, name)`. Move `Env` type to new `env.js` module. Remove `requireNodeEnv` (use `requireEnvVar(process.env, name)`) and `requireNetworkId` (use `requireEnvVar(resolveEnv(), 'NETWORK_ID')`).
- 3ae76c4: Rename package to `@sundaeswap/capacity-exchange-nodejs`
- 64ef4d9: Split `AppConfig` into `NetworkConfig` + `WalletConfig`. Replace `getAppConfigById` with pure builders (`buildAppConfig`, `buildNetworkConfig`, `buildWalletConfig`) that take an explicit `Env`, plus `resolveEnv()` for env-based composition. `buildWalletConfig` now requires `WALLET_STATE_DIR` (previous `./.wallet-state-<network>` default removed). `AppContext.proofServerUrl` moves to `config.network.endpoints.proofServerUrl`. `withAppContext` now takes an `AppConfig`; use the new `withAppContextFromEnv(networkId, fn)` for the prior env-based behavior. Add `loadWalletSeedFromEnv(env)` (no walk-up) and `createPublicDataProvider(network)` for read-only callers. Rename CLI `seed-wallet-state` → `restore-from-chain-snapshot` with `--seed-file` / `--mnemonic-file` flags.
- 9c5d7f2: Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
- Updated dependencies [76aa1ef]
- Updated dependencies [da29c54]
- Updated dependencies [8dfe09a]
- Updated dependencies [3ae76c4]
- Updated dependencies [19de633]
- Updated dependencies [f0acfbc]
- Updated dependencies [af592bf]
- Updated dependencies [64ef4d9]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-providers@2.0.0
  - @sundaeswap/capacity-exchange-nodejs@2.0.0
  - @capacity-exchange/demo-contracts@1.0.2
  - @sundaeswap/capacity-exchange-registry@1.1.0
  - @sundaeswap/capacity-exchange-core@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [2027d29]
  - @sundaeswap/capacity-exchange-core@1.1.0
  - @sundaeswap/capacity-exchange-providers@1.3.0
  - @sundaeswap/capacity-exchange-client@1.1.0
  - @capacity-exchange/demo-contracts@1.0.1
  - @sundaeswap/capacity-exchange-nodejs@1.0.1
