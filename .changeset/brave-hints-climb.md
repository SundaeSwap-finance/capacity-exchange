---
"@capacity-exchange/server": minor
"@sundaeswap/capacity-exchange-client": minor
"@capacity-exchange/cardano-core": patch
---

Serve CIP-0198 price hints at `GET /api/cardano/hints`: signed price ladders that follow the Cardano wallet's balance, configured under `cardano.prices` in the price config and signed with the key in `CARDANO_HINTS_SKEY_FILE`. `GET /api/cardano/prices` stays until its callers read hints instead, and will then be retired.
