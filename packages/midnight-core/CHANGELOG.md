# @sundaeswap/capacity-exchange-core

## 1.2.0

### Minor Changes

- 19de633: Add `parsePositiveNumber(name, raw)` helper. Use it in `buildWalletConfig` and the registry CLIs (`deploy`, `register`, `renew-registration`) instead of inline `Number(...) + isFinite + > 0` checks.

## 1.1.0

### Minor Changes

- 2027d29: Improve APIs for easier dApp integration.
