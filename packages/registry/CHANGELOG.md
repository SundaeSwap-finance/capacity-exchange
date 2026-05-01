# @sundaeswap/capacity-exchange-registry

## 1.1.0

### Minor Changes

- af592bf: - Rename `refreshValidity` → `renewRegistration` and `validTo` → `expiry` throughout
  - Rename `ValidityInterval` → `Period` (`maximumValidityInterval` → `maximumRegistrationPeriod`, `maxValidityInterval` → `maxPeriod`)
  - Add `claim-expired` CLI to deregister expired entries without a secret key
  - CLI arguments now accept days instead of raw seconds for registration period
  - Use randomly generated `privateStateId` per call

### Patch Changes

- 8dfe09a: Use `@midnight-ntwrk/midnight-js-compact` to compile contracts, instead of bundled compactc
- 19de633: Add `parsePositiveNumber(name, raw)` helper. Use it in `buildWalletConfig` and the registry CLIs (`deploy`, `register`, `renew-registration`) instead of inline `Number(...) + isFinite + > 0` checks.
- 9c5d7f2: Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
- Updated dependencies [da29c54]
- Updated dependencies [3ae76c4]
- Updated dependencies [19de633]
- Updated dependencies [64ef4d9]
- Updated dependencies [9c5d7f2]
  - @sundaeswap/capacity-exchange-nodejs@2.0.0
  - @sundaeswap/capacity-exchange-core@1.2.0
