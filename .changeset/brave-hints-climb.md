---
"@capacity-exchange/server": major
"@sundaeswap/capacity-exchange-client": major
"@capacity-exchange/cardano-core": patch
"@capacity-exchange/funder-cli": patch
---

Serve CIP-0198 price hints at `GET /api/cardano/hints`, replacing `GET /api/cardano/prices`. Hints are signed price ladders built from `priceFormulas.ADA`, whose formulas now take `tiers: [{ above, rateNumerator, rateDenominator }]` instead of a flat rate: each tier's rate applies while the Cardano wallet holds more lovelace than its `above`, and nothing is offered below the lowest. Hints are signed with the payment key in `CARDANO_WALLET_SKEY_FILE`, which must belong to `CARDANO_WALLET_ADDRESS`; a server that prices ADA refuses to start without it, `CARDANO_UTXORPC_URL` and `CARDANO_WALLET_ADDRESS`. The client's `apiCardanoPricesGet` is removed. ADA is no longer quotable through `GET /api/prices`, and the funder-cli's `quote` step fails until it reads hints.
