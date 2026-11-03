# @capacity-exchange/funder-cli

## 0.1.1

### Patch Changes

- 283704b: Serve CIP-0198 price hints at `GET /api/cardano/hints`, replacing `GET /api/cardano/prices`. Hints are signed price ladders built from `priceFormulas.ADA`, whose formulas now take `tiers: [{ above, rateNumerator, rateDenominator }]` instead of a flat rate: each tier's rate applies while the Cardano wallet holds more lovelace than its `above`, and nothing is offered below the lowest. Hints are signed with the key in `CARDANO_REGISTRATION_SKEY_FILE`; a server that prices ADA refuses to start without it, `CARDANO_UTXORPC_URL` and `CARDANO_WALLET_ADDRESS`. ADA is no longer quotable through `GET /api/prices`.
- faacd24: Add an endpoint to accept user offers
- Updated dependencies [283704b]
- Updated dependencies [457074c]
- Updated dependencies [dcd3ecb]
- Updated dependencies [faacd24]
  - @sundaeswap/capacity-exchange-client@3.0.0
  - @capacity-exchange/cardano-core@1.0.1
