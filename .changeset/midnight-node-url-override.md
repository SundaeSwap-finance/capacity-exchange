---
'@sundaeswap/capacity-exchange-core': major
'@sundaeswap/capacity-exchange-nodejs': minor
---

BREAKING: resolveEndpoints and resolveWalletConfig now take an overrides object (Partial<NetworkEndpoints>) instead of a positional proofServerUrl string. Adds a NODE_URL env override for the Midnight node, exports redactUrl, and redacts node URLs in logs so an embedded API key is not exposed.
