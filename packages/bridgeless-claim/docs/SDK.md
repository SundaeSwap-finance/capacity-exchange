# SDK

The SDK is the user-side library that dApps integrate with to run the bridgeless flow. The **User's** dApp depends on it.

## Responsibilities

The SDK:

1. **Generates** two secrets per swap, `s` (eventually public) and `s'` (always private), and computes `h = hash(s)` and `h' = hash(s')`
2. **Holds `s'` privately** in user-side state for the whole swap. Uses `s'` only in the witness function when calling the **Coupler's** `mintReveal`
3. **Discovers** an **LP** via the existing CES registry and requests a price quote from the **LP's** `/prices` endpoint, receiving a signed quote token and Cardano `lp_address`
4. **Reads** the settings utxo (see [VALIDATOR.md Settings utxo](VALIDATOR.md#settings-utxo)) to enforce `max_ada_payout` before creating an escrow
5. **Constructs** the Cardano escrow transaction with the datum `{ h, h_prime, refund_address, lp_address, eTTL }` and locks the quoted lovelace at the utxo at the **Escrow Bearer's** address
6. **Calls** the **LP's** `POST /ada/offers` endpoint (after the escrow utxo has reached the **LP's** `confirmationDepth` on Cardano) with the escrow's utxo reference, the `quoteId`, and the **Coupler** address, receiving the **LP's** capacity leg as response
7. **Builds** the **User's** reveal leg containing `mintReveal(disclose(s), witness(s'))` plus the **User's** `user_op`, merges with the **LP's** capacity leg, signs the merged tx, and submits to Midnight
8. **Constructs** the Cardano refund transaction when invoked after `eTTL`. The refund tx doesn't require a signature since ADA flows to `datum.refund_address` regardless of submitter

Details about the payload shape required to integrate with the Cardano Bearer can be found in [VALIDATOR.md](VALIDATOR.md).

## Persistence

`s'` (and `s`, until the merged tx is submitted) must persist until the escrow utxo has reached a terminal state. If `s'` is lost before the merged tx is submitted, the swap can't complete and the **User** must refund after `eTTL` and retry. Losing `s` after `mintReveal` is called is fine since `s` is public on Midnight at that point.

The SDK uses Midnight's `PrivateStateProvider` to store the private witness `s'` used in the **Coupler's** `mintReveal`.

## Tracking active escrows

The SDK will store active escrow utxo details in local storage so that if a refund is necessary, the details are easily accessible. We'll also scan **Bearer** utxos for `datum.refund_address == self` either periodically, with a manual refresh-button press from the user, or both.

## Failure modes (User perspective)

| Failure | User impact |
|---|---|
| Quote token expires before the **User** submits the escrow | **User** must request a new quote and rebuild the escrow tx (and retrieve their escrow after `eTTL`) |
| **LP** rejects `POST /ada/offers` (datum mismatch, insufficient confirmations, etc.) | **User** waits for confirmations and retries, or re-issues with a different **LP** if the **LP's** policy is stricter than expected |
| **LP** unresponsive after `POST /ada/offers` | **User** waits past `eTTL` and refunds |
| Merged tx fails to finalize on Midnight before `mTTL` | **User** waits past `eTTL` and refunds |
| **User** loses `s'` before submitting the merged tx | **User** waits past `eTTL` and refunds |
| **User** loses local SDK state (cleared storage, fresh device) | SDK rebuilds active-escrow list from on-chain scan of `datum.refund_address`; refund still possible (any party can submit since ADA is pinned to `refund_address`) |
