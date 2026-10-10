# @sundaeswap/capacity-exchange-core

## 2.1.0

### Minor Changes

- 22ea004: Support "inert" DUST wallets which contain no DUST and do no work. Useful for demos or tests.

## 2.0.0

### Major Changes

- b1d5ce6: BREAKING: resolveEndpoints and resolveWalletConfig now take an overrides object (Partial<NetworkEndpoints>) instead of a positional proofServerUrl string. Adds a NODE_URL env override for the Midnight node, exports redactUrl, and redacts node URLs in logs so an embedded API key is not exposed.

### Patch Changes

- f561665: Scope the extension approval guard to the wallets that need it. `connectMidnightExtension` now guards only Lace by default (`approvalGuard: 'auto'`), so other wallet extensions get their connector API back untouched. Pass `approvalGuard: true` to guard whatever wallet connected. `detectMidnightExtension` also reports the `globalThis.midnight` key the connector was injected under.

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
