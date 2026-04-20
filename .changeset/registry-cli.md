---
'@sundaeswap/capacity-exchange-registry': minor
---

- Rename `refreshValidity` → `renewRegistration` and `validTo` → `expiry` throughout
- Rename `ValidityInterval` → `Period` (`maximumValidityInterval` → `maximumRegistrationPeriod`, `maxValidityInterval` → `maxPeriod`)
- Add `claim-expired` CLI to deregister expired entries without a secret key
- CLI arguments now accept days instead of raw seconds for registration period
- Use randomly generated `privateStateId` per call
