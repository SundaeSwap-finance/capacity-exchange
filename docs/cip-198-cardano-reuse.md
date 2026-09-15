# Could Capacity Exchange's code be reused for a Cardano CIP-198 service?

CIP-198 ([cardano-foundation/CIPs#1257](https://github.com/cardano-foundation/CIPs/pull/1257))
is a Cardano proposal, not a Midnight one. It builds on CIP-118's "babel fee
offer" idea: a sub-transaction that doesn't balance on its own (say, it has
more of a token in it than it needs, and is short the ADA to pay its own
fee). Some other party then folds that sub-transaction into one valid,
complete transaction. Since Capacity Exchange does a similar job for
Midnight, it's worth asking: could its *code* — not just the idea — be
reused to build a real Cardano version of CIP-198?

Short answer: mostly no, once you get past the API layer.

## What Capacity Exchange does today

It isn't a batching service in the CIP-198 sense on the Cardano side:

- **Sponsor flow** (`apps/server/src/routes/sponsor.ts` →
  `services/sponsor.ts` → `services/tx.ts`) does combine a server-built
  fee-paying piece with a user's transaction — kind of close to CIP-198's
  idea — but it's built entirely on Midnight's `ledger-v8` tools (`Intent`,
  `DustActions`, `dustTx.merge(userTx)`, proof/binding steps, shielded
  `ZswapOffer`).
- **Offer flow** (`routes/offers.ts`, `routes/adaOffers.ts`,
  `services/cardano.ts`) does touch Cardano today, but only to check
  payment — it verifies a lovelace UTXO through Blockfrost, then hands back
  a Midnight DUST UTXO in exchange. Neither flow actually does what CIP-198
  describes (merging sub-transactions) on the Cardano side.

## What could actually be reused

- **Mostly reusable as-is:** everything that isn't ledger code — the
  Fastify routes/API validation, the pricing/quote engine
  (`services/price.ts`, `services/formulaIndex.ts`, `services/quote.ts`),
  metrics, config loading, and the peer-discovery protocol used to fall back
  between sponsor servers.
- **Reusable with some rework:** the high-level flow in
  `sponsor.ts`/`offer.ts` — check eligibility, lock a UTXO, cache, handle
  errors. The overall shape ("lock something → build the fee-covering
  piece → merge → submit") still makes sense, even though the actual
  object being locked/merged/submitted would need to be a Cardano type
  instead of a Midnight one.
- **Not reusable, needs to be rewritten:** `services/tx.ts`, the UTXO
  lock/spend code in `services/utxo.ts`, and the wallet/transaction code in
  `packages/providers/src/wallet/*` are all built on Midnight's model
  (proofs, binding steps, intents, shielded UTXOs). Cardano's model is
  plain, transparent UTXOs with balanced transactions — nothing to port
  here. A real Cardano version would need new transaction-building code
  (via Lucid, MeshJS, or cardano-serialization-lib) once CIP-198's rules
  are finalized. Same story for `packages/registry` — it's a Midnight
  `.compact` contract. The idea (a discoverable registry with a deposit) is
  reusable; the contract itself would need to be rewritten in Plutus or
  Aiken.

## Bottom line

Keep the API layer, the pricing engine, and the overall flow as a template.
The actual transaction-building and the on-chain registry would need to be
built from scratch, once CIP-198's rules are finalized.

## Things CIP-198 itself hasn't figured out yet, and how they relate to us

The CIP-198 spec ([full diff](https://github.com/cardano-foundation/CIPs/pull/1257/files))
still has some open or shaky parts. Most of them line up with problems
Capacity Exchange already has, so they're worth keeping an eye on:

- **The main batching part can't be built yet — it's waiting on a ledger
  change nicknamed "Dijkstra."** The CIP says (in its "Work blocked on
  prerequisites" and "Path to Active" sections) that the exact byte format,
  fee math, and collateral handling are all "blocked on the final
  CIP-0118/Dijkstra ledger interface," and its own launch checklist needs
  "CIP-0118 is Active and the Dijkstra CDDL is final on a public network."
  It's still marked `Proposed`.

  **If that ledger change were ready**, the real questions for us would be:
  - Which Cardano library (Lucid, MeshJS, cardano-serialization-lib)
    supports the finished sub-transaction format first?
  - Would we run this as a CIP-198 **service** (holding ADA, building and
    paying for batches) or more like a **relay** (just forwarding offers,
    no money at risk)?
  - How would our current eligibility check (an allowlist of
    contracts/circuits) map onto the CIP's service profile — as a public
    filter, or kept as a private rule like today?
  - Could `services/quote.ts`'s signed quote be reused as the CIP's
    non-binding "price hint," or does the CIP's format need something new?
  - Would we run our own on-chain registry, or just register with whatever
    shared registry the ecosystem ends up using?
  - How much ADA/collateral would we need to hold, and how would that be
    funded and topped up?
- **The CIP's rules about holding funds point at a bug we already have.**
  The CIP says a service must keep a UTXO locked "until that build finishes
  or gives up," and keep collateral fully separate — basically, don't let
  two things spend the same money. Our
  [`UtxoService.lockUtxo`](../apps/server/src/services/utxo.ts) only keeps
  its locks in memory (there's already a `TODO` about this in the code), so
  a restart mid-request can lose a lock and risk a double-spend. This is
  exactly the problem the CIP is warning about.
- **Handling rolled-back blocks.** The CIP explains what a service should
  do if a block it already submitted gets reverted — treat the offer as
  not-yet-included again, not as done. We don't handle this at all today.
  The CIP treats it as required, not optional.
- **The CIP's registry does a lot more than ours.** CIP-198's registry
  isn't just a URL — it's an on-chain record (an NFT) with a
  deposit-weighted random pick for who talks to whom, a published profile
  of what a service accepts, budget limits, and separate price hints served
  over plain HTTP. `packages/registry` today only stores a domain name.
- **Price hints — this one's actually good news.** The CIP keeps prices
  off-chain and non-binding on purpose ("a rate that moves faster than a
  block shouldn't be fixed on-chain"). That's basically what
  [`services/quote.ts`](../apps/server/src/services/quote.ts) already
  does — a signed, time-limited quote instead of an on-chain price. We're
  already doing this part the way the CIP recommends.
- **Most of the security section doesn't apply to us, but two bits do.**
  Things like fake registry entries, front-running over a gossip network,
  or fake price hints all assume a network of strangers, which we don't
  have (one client talks to one server directly). Two things are still
  worth a look even so:
  - **Silently dropped requests.** The CIP suggests occasionally sending
    fake "test" requests through a peer to check it isn't silently
    swallowing traffic. Since we can fall back to a peer server
    ([`sponsor.ts:90-119`](../apps/server/src/services/sponsor.ts#L90)),
    something similar might be worth doing there.
  - **Checking again right before submitting.** The CIP says a service
    must re-check every input it's about to spend right before sending the
    transaction, not just when it first locked it. Worth confirming our
    lock-then-build flow actually does this final check right before
    submit, not only at lock time.

## TODO

The real batch-construction mechanic (the actual point of CIP-198) is blocked
on Dijkstra/CIP-118 landing on a public network — see the section above. That
work is someone else's timeline, not ours, so it's left out of these lists
entirely. Everything below is buildable and testable *today*, without it.

### 1. Off-chain protocol pieces (no ledger dependency at all)

These mirror the parts of CIP-198's own Implementation Plan that are already
checked off *because* they don't need a live Dijkstra network — pure format
and algorithm work we could build and unit-test against the CIP's published
test vectors right now, ahead of having anywhere real to submit a batch to.

- [ ] Envelope wire format: encoder/decoder for `[envelope_version, era_tag,
      subtx_bytes]`, checked against CIP-198's published byte-level test
      vectors.
- [ ] Constraint-language (DSL) encoder/decoder: the `PaidAtLeast` / `Guards`
      / `All` / `AnyOf` / `True` PlutusData encoding — pure serialization,
      testable without any chain.
- [ ] v1 selection/packing algorithm (greedy value density): implement and
      unit-test against synthetic offer sets, independent of what an actual
      sub-transaction looks like under Dijkstra.
- [ ] Stateless offer checks (the ones that don't need chain state): shape
      caps (`MAX_CONSTRAINT_DEPTH`, `MAX_CONSTRAINT_NODES`,
      `MAX_BACKTRACKING_BUDGET`), envelope well-formedness, dedup-key
      derivation.
- [ ] A minimal relay: forward what passes the stateless checks, dedupe,
      rate-limit — CIP-198 calls this the "obligation floor" and it's
      explicitly transport-independent, so it doesn't need real sub-txs to
      exist yet.

### 2. Registry (chain-specific, but not Dijkstra-dependent)

- [ ] Design a Plutus/Aiken registry contract with the same idea as
      `packages/registry` (on-chain NFT registration, deposit-backed,
      expiring) — the Midnight `.compact` contract can't be reused, but
      nothing about a registry needs CIP-118/Dijkstra. Buildable and
      deployable on preview/preprod now.
- [ ] Decide whether to publish a CIP-198-shaped "service profile" (accept/
      reject filter keys, budgets, constraint versions) from day one, even
      before there's a real batching service behind it.

### 3. Reuse from the current (Midnight) codebase

- [ ] Pull out the chain-agnostic parts as something explicitly shared
      instead of copy-pasting: the pricing/quote engine
      (`services/price.ts`, `services/formulaIndex.ts`, `services/quote.ts`),
      metrics, config loading, and the peer-discovery protocol.
- [ ] Sketch the high-level flow from `sponsor.ts`/`offer.ts` (eligibility
      checks, locking, caching, error handling) as a template against a
      Cardano-native UTXO/transaction type — a design sketch, not a working
      implementation, since the real transaction-building layer still has
      nowhere to plug into until Dijkstra ships.
- [ ] Decide whether this lives as a new package/service next to the
      Midnight one, or a separate repo entirely.

### 4. Findings from this review worth fixing now, regardless of Cardano

Not CIP-198 work at all — just things this comparison surfaced in the
existing Midnight-side code, independent of any Dijkstra timeline:

- [ ] Check whether Capacity Exchange's *current* (Midnight) sponsor flow
      re-checks a locked UTXO against live chain state right before
      submitting, not only when it's first locked.
- [ ] Consider a test-request check on the peer-fallback path
      (`sponsor.ts:90-119`) to catch a peer server silently dropping
      requests instead of erroring.
- [ ] Persist `UtxoService.lockUtxo`'s lock state (currently in-memory only,
      `apps/server/src/services/utxo.ts`) so a restart can't lose a lock and
      risk a double-spend.

### Explicitly deferred (do not start until Dijkstra ships)

- Any real sub-transaction/batch transaction-building layer (replaces
  `services/tx.ts` and the lock/spend logic in `services/utxo.ts` for a
  Cardano version).
- Anything requiring `field-23` encoding, compositional minimum-fee
  calculation, collateral accounting, or execution-unit accounting for a
  batch.
- The devnet interoperability demonstration CIP-198's own acceptance
  criteria calls for.
