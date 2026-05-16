# Commitment coupler

The **Commitment Coupler** is the Midnight-side Compact contract that binds the **User's** secrets to the **LP's** DUST exchange.

## What it is

A Compact contract on Midnight with two circuits:

- **`mintReveal(disclose(s), witness(s'))`**: mints one unshielded token of color `hash(hash(s) ‖ hash(s'))`. The `s` argument is publicly disclosed in the on-chain extrinsic call data. The `s'` argument is supplied through a witness function and so never appears on chain.
- **`absorb(h, h')`**: receives one token of color `hash(h ‖ h')` into the contract. Both arguments are public.

The two circuits are designed to balance against each other only when the colors match, which forces `(hash(s), hash(s')) == (h, h')` via Midnight's ledger balance check. The **LP** calls `absorb` after learning `h` and `h'` from the escrow utxo datum.

## Reference impl

The PoC source is `prototypes/midnight-mint-disclose/mint_disclose.compact` in PR #128 on the `SundaeSwap-finance/capacity-exchange` repo.