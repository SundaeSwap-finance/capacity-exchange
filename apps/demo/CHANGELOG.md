# @capacity-exchange/demo

## 1.0.7

### Patch Changes

- 7080f1a: Upgrade all Midnight dependencies to support ledger v9. This is now compatible with all environments.
- Updated dependencies [283704b]
- Updated dependencies [060c019]
- Updated dependencies [457074c]
- Updated dependencies [faacd24]
- Updated dependencies [7080f1a]
  - @sundaeswap/capacity-exchange-client@3.0.0
  - @sundaeswap/capacity-exchange-core@3.0.0
  - @sundaeswap/capacity-exchange-providers@5.0.0
  - @capacity-exchange/archive-tools@1.0.1

## 1.0.6

### Patch Changes

- Updated dependencies [f561665]
- Updated dependencies [b1d5ce6]
  - @sundaeswap/capacity-exchange-core@2.0.0
  - @sundaeswap/capacity-exchange-providers@3.0.4

## 1.0.5

### Patch Changes

- Updated dependencies [6b97231]
- Updated dependencies [571226c]
- Updated dependencies [5a6ab4f]
- Updated dependencies [df0e5d6]
- Updated dependencies [d0ddfd8]
  - @sundaeswap/capacity-exchange-core@1.3.0
  - @sundaeswap/capacity-exchange-providers@3.0.0
  - @sundaeswap/capacity-exchange-client@1.2.0

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
