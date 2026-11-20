# @capacity-exchange/cardano-core

## 1.0.1

### Patch Changes

- 283704b: Serve CIP-0198 price hints at `GET /api/cardano/hints`, replacing `GET /api/cardano/prices`. Hints are signed price ladders built from `priceFormulas.ADA`, whose formulas now take `tiers: [{ above, rateNumerator, rateDenominator }]` instead of a flat rate: each tier's rate applies while the Cardano wallet holds more lovelace than its `above`, and nothing is offered below the lowest. Hints are signed with the key in `CARDANO_REGISTRATION_SKEY_FILE`; a server that prices ADA refuses to start without it, `CARDANO_UTXORPC_URL` and `CARDANO_WALLET_ADDRESS`. ADA is no longer quotable through `GET /api/prices`.
- 457074c: The server tracks cardano UTXOs, and exposes them in the health endpoint
- dcd3ecb: Build transactions containing a single subtx in the server as needed
- faacd24: Add an endpoint to accept user offers
