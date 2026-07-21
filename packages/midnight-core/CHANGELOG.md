# @sundaeswap/capacity-exchange-core

## 2.0.0

### Major Changes

- b1d5ce6: BREAKING: resolveEndpoints and resolveWalletConfig now take an overrides object (Partial<NetworkEndpoints>) instead of a positional proofServerUrl string. Adds a NODE_URL env override for the Midnight node, exports redactUrl, and redacts node URLs in logs so an embedded API key is not exposed.

## 1.3.2

### Patch Changes

- c3f36f9: Update CI to bump versions as needed

## 1.3.1

### Patch Changes

- 0f612a3: Reference latest versions of internal modules

## 1.3.0

### Minor Changes

- 6b97231: Upgrade midnight dependencies to latest preprod versions.
  Fix import style to work on npm without bundling.

### Patch Changes

- d0ddfd8: Unshielded Token Offer

## 1.2.0

### Minor Changes

- 19de633: Add `parsePositiveNumber(name, raw)` helper. Use it in `buildWalletConfig` and the registry CLIs (`deploy`, `register`, `renew-registration`) instead of inline `Number(...) + isFinite + > 0` checks.

## 1.1.0

### Minor Changes

- 2027d29: Improve APIs for easier dApp integration.
