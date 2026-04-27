---
'@sundaeswap/capacity-exchange-core': minor
'@sundaeswap/capacity-exchange-nodejs': patch
'@sundaeswap/capacity-exchange-registry': patch
---

Add `parsePositiveNumber(name, raw)` helper. Use it in `buildWalletConfig` and the registry CLIs (`deploy`, `register`, `renew-registration`) instead of inline `Number(...) + isFinite + > 0` checks.
