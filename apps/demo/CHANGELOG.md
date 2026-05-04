# @capacity-exchange/demo

## 1.0.4

### Patch Changes

- da29c54: Converge env reads behind `resolveEnv()` + `requireEnvVar(env, name)`. Move `Env` type to new `env.js` module. Remove `requireNodeEnv` (use `requireEnvVar(process.env, name)`) and `requireNetworkId` (use `requireEnvVar(resolveEnv(), 'NETWORK_ID')`).
- 3ae76c4: Rename package to `@sundaeswap/capacity-exchange-nodejs`
- 9c5d7f2: Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
- Updated dependencies [76aa1ef]
- Updated dependencies [19de633]
- Updated dependencies [f0acfbc]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-providers@2.0.0
  - @sundaeswap/capacity-exchange-core@1.2.0

## 1.0.3

### Patch Changes

- Updated dependencies [2027d29]
  - @sundaeswap/capacity-exchange-core@1.1.0
  - @sundaeswap/capacity-exchange-providers@1.3.0
  - @sundaeswap/capacity-exchange-client@1.1.0

## 1.0.2

### Patch Changes

- f6407b1: Improve documentation for public API, and remove some required fields
- Updated dependencies [f6407b1]
  - @sundaeswap/capacity-exchange-providers@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [0ce4581]
  - @sundaeswap/capacity-exchange-providers@1.1.0
