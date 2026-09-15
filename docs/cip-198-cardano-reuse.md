# Could Capacity Exchange's code be repurposed for a Cardano CIP-198 service?

CIP-198 ([cardano-foundation/CIPs#1257](https://github.com/cardano-foundation/CIPs/pull/1257))
is a Cardano proposal, not a Midnight one — it builds on CIP-118's "babel fee
offer": a sub-transaction that doesn't balance on its own (e.g. more of a
token in the inputs than the outputs, and vice versa for ADA), which some
other party then folds into a fully valid top-level transaction. This spawns
a natural question: could Capacity Exchange's *code* — not just the
concept — be reused to build a real Cardano-side implementation of CIP-198?

Short answer: mostly not, once you get past the API/business layer.

## What Capacity Exchange actually does today

It isn't a batching/merge service in the CIP-198 sense on the Cardano side:

- **Sponsor flow** (`apps/server/src/routes/sponsor.ts` →
  `services/sponsor.ts` → `services/tx.ts`) does merge a server-built
  fee-paying piece with a user's transaction — conceptually close to
  CIP-198's merge idea — but entirely on Midnight's `ledger-v8` primitives
  (`Intent`, `DustActions`, `dustTx.merge(userTx)`, proof/binding stages,
  shielded `ZswapOffer`).
- **Offer flow** (`routes/offers.ts`, `routes/adaOffers.ts`,
  `services/cardano.ts`) touches Cardano today, but only as a payment rail —
  verifying a lovelace UTXO via Blockfrost in exchange for a Midnight DUST
  UTXO. Neither flow implements CIP-198's actual sub-transaction/merge
  semantics for Cardano.

## Reuse breakdown

- **Reusable close to as-is:** the non-ledger scaffolding — Fastify
  routes/API validation, the pricing/quote/formula engine
  (`services/price.ts`, `services/formulaIndex.ts`, `services/quote.ts`),
  metrics/observability, config loading, and the peer-discovery HTTP protocol
  used to fall back between sponsor servers.
- **Reusable with a thin adapter:** the high-level control flow in
  `sponsor.ts`/`offer.ts` — eligibility checks, UTXO locking, caching,
  error-result handling. The *shape* ("lock → build fee-covering piece →
  merge → submit") carries over conceptually even though the object being
  locked/merged/submitted would have to become a Cardano-native type.
- **Not reusable, needs a rewrite:** `services/tx.ts`, the UTXO lock/spend
  logic in `services/utxo.ts`, and the wallet/transaction-building code in
  `packages/providers/src/wallet/*` are built end to end on Midnight's
  proof/binding/intent ledger model (shielded UTXOs, generation-tree state),
  which has no structural analog in Cardano's transparent-UTXO/balanced-
  transaction model. A real
  Cardano CIP-198 service would need new transaction-building code (e.g. via
  Lucid, MeshJS, or cardano-serialization-lib) implementing CIP-198's own
  sub-transaction/merge rules once ratified. Likewise, `packages/registry`'s
  on-chain directory is a Midnight `.compact` contract — the concept (a
  discoverable, collateralized registry of services) is reusable, but the
  implementation would need a Plutus/Aiken rewrite.

## Conclusion

The API layer, pricing engine, and orchestration pattern are worth carrying
over as a template; the actual transaction-building and on-chain registry
contract are not portable and would need to be built fresh against CIP-198's
real (still-unratified) sub-transaction semantics.

## TODO

- [ ] Stand up a new Cardano transaction-building layer (via Lucid, MeshJS,
      or cardano-serialization-lib) implementing CIP-118/CIP-198's
      sub-transaction construction and merge rules — this replaces
      `services/tx.ts` and the UTXO lock/spend logic in `services/utxo.ts`
      wholesale, not incrementally.
- [ ] Design a Plutus/Aiken registry contract covering the same concept as
      `packages/registry` (discoverable, collateralized service directory)
      — the Midnight `.compact` contract itself isn't portable.
- [ ] Extract the chain-agnostic pieces into something explicitly reusable
      rather than copy-pasting: the pricing/quote/formula engine
      (`services/price.ts`, `services/formulaIndex.ts`, `services/quote.ts`),
      metrics/observability stack, config loading, and the peer-discovery
      HTTP protocol.
- [ ] Re-shape the high-level control flow from `sponsor.ts`/`offer.ts`
      (eligibility checks, locking, caching, error-result handling) around a
      Cardano-native transaction/UTXO type, using it as a template rather
      than attempting a direct port.
- [ ] Decide whether this lives as a new package/service alongside the
      Midnight one, or a genuinely separate repo — the two would share
      almost nothing below the API layer.
