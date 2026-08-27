---
'@sundaeswap/capacity-exchange-core': patch
---

Scope the extension approval guard to the wallets that need it. `connectMidnightExtension` now guards only Lace by default (`approvalGuard: 'auto'`), so other wallet extensions get their connector API back untouched. Pass `approvalGuard: true` to guard whatever wallet connected. `detectMidnightExtension` also reports the `globalThis.midnight` key the connector was injected under.
