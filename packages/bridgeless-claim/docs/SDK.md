# SDK

The SDK is the user-side library that dApps integrate with to run the bridgeless flow. Runs in the **User's** dApp.

## Responsibilities

The SDK:

1. **Generates** two secrets per swap, `s` (eventually public) and `s'` (always private), and computes `h = hash(s)` and `h' = hash(s')`
2. **Holds `s'` privately** in user-side state for the whole swap. Uses `s'` only in the witness function when calling the **Coupler's** `mintReveal`
3. **Discovers** an **LP** via the existing CES registry and requests a price quote from the **LP's** `/prices` endpoint, receiving a signed quote token and Cardano `lp_address`
4. **Constructs** the Cardano escrow transaction with the datum `(h, h', user_signing_key, lp_address, eTTL, amount_ada)`
5. **Calls** the **LP's** `POST /ada/offers` endpoint with the escrow's utxo reference, the `quoteId`, and the **Coupler** address, receiving the **LP's** capacity leg as response
6. **Builds** the **User's** reveal leg containing `mintReveal(disclose(s), witness(s'))` plus the **User's** `user_op`, merges with the **LP's** capacity leg, signs the merged tx, and submits to Midnight
7. **Constructs** the Cardano refund transaction when invoked after `eTTL`, signed by the **User's** signing key, with no proof requirement

Details about the payload shape required to integrate with the Cardano Bearer can be found in [VALIDATOR.md](VALIDATOR.md).

## Persistence

`s'` (and `s`, until the merged tx is submitted) must persist until the **User's** Midnight op is finalized. If `s'` is lost before the merged tx is submitted, the swap can't complete and the **User** must refund after `eTTL` and retry. Losing `s` after `mintReveal` is called is fine since `s` is public on Midnight at that point.

The SDK uses Midnight's `PrivateStateProvider` to store the private witness `s'` used in the **Coupler's** `mintReveal`.

## Failure modes (User perspective)

| Failure | User impact |
|---|---|
| Quote token expires before the **User** submits the escrow | **User** must request a new quote and rebuild the escrow tx (and retrieve their escrow after `eTTL`) |
| **LP** rejects `POST /ada/offers` (datum mismatch, insufficient confirmations, etc.) | **User** waits for confirmations and retries, or re-issues with a different **LP** if the **LP's** policy is stricter than expected |
| **LP** unresponsive after `POST /ada/offers` | **User** waits past `eTTL` and refunds |
| Merged tx fails to finalize on Midnight before `mTTL` | **User** waits past `eTTL` and refunds |
| **User** loses `s'` before submitting the merged tx | **User** waits past `eTTL` and refunds |
