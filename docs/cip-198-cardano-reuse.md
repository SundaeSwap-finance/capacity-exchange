# Could Capacity Exchange's code be reused for a Cardano CIP-198 service?

CIP-198 ([cardano-foundation/CIPs#1257](https://github.com/cardano-foundation/CIPs/pull/1257))
is still an actively-edited, `Proposed` draft — treat this doc as a snapshot,
and the PR itself as the source of truth if anything here seems out of date.

**In the simplest terms:**  A separate ledger change (CIP-118) will let someone build an unfinished,
lopsided "sub-transaction" — it spends your non-ADA token but since it doesn't cover its own
ADA fee, it can't be posted on its own. **CIP-198 is the rulebook for how
some other party finds that unfinished piece, completes it (supplying the
missing ADA in exchange for your token), and posts the whole thing as one
real transaction** — how you'd broadcast the unfinished piece, how a
completing party advertises what it accepts and at what price, and how it
stitches several people's pieces together into one transaction. CIP-118 makes
the unfinished piece legal; CIP-198 is how it actually gets finished and
posted, by someone else, for a fee.

Short answer: mostly no. Even where the underlying approach transfers (the
API shape, the pricing engine, config/metrics patterns), that's a case for
reusing the *design*, not the TypeScript — TS was forced on Capacity
Exchange by Midnight's SDK, and nothing forces it for a Cardano
implementation.

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

- **Reusable as a design, not necessarily as TypeScript code** (correction —
  an earlier version of this doc conflated the two): the *approach* behind
  the Fastify routes/API validation, the pricing/quote engine
  (`services/price.ts`, `services/formulaIndex.ts`, `services/quote.ts`),
  metrics, config loading, and the peer-discovery fallback protocol all
  transfer as ideas. Whether the actual TS code is worth carrying over is a
  separate question. Cardano's tooling splits across non-TS languages: `cardano-ledger` is
  Haskell, and so — verified directly, not assumed — is `dmq-node`, the
  actual prior art CIP-198 itself cites for its gossip layer (`IntersectMBO/dmq-node`,
  built on Ouroboros-Network). Newer performance-oriented tooling (Pallas,
  the Amaru node) is Rust. Neither camp is TypeScript. CIP-198's own
  acceptance criteria requires *"two implementations
  built independently interoperate"* on the wire format, so matching
  whatever language the reference implementation actually ends up in may
  matter more than reusing our TS. Treat this bullet's contents as "designs
  worth copying," not "modules worth importing."
- **Reusable as a concept, not as a shape** (correction — an earlier version
  of this doc overstated this): CES's `sponsor.ts`/`offer.ts` flow is
  "lock a UTXO → build a fee-covering piece → merge two built transactions →
  submit," and that shape is actually a poor match for CIP-198, not a rework
  candidate. CIP-198's service is asynchronous and batch-oriented, and each
  step differs for a structural reason, not just a type difference:
  - **No per-request lock.** CIP-198 pushes toward funding a batch from an
    *account* rather than discrete UTXOs specifically to avoid a per-payment
    floor — an account isn't subdivided into lockable pieces at all. CES's
    `UtxoService.lockUtxo` exists because CES answers one synchronous caller
    at a time; CIP-198's service never does that.
  - **No response cache.** CES caches the built offer response because a
    caller might retry a synchronous call and needs the same answer back.
    CIP-198 offers arrive into a pool asynchronously with no meaningful
    reply — the publisher is expected to watch the chain itself; `GET
    /offers/{id}` is explicitly *not* a reliable "did it land" answer. What
    CIP-198 needs instead is offer-*state* tracking (received → verified →
    included in batch → submitted → confirmed), a different mechanism from
    an HTTP response cache.
  - **No merge.** CES's `dustTx.merge(userTx)` combines two independently
    built Midnight `Transaction`/`Intent` objects via the SDK's own
    multi-intent structure. CIP-198 doesn't merge peer transactions — it
    nests sub-transaction bytes verbatim inside one enclosing transaction
    (CIP-118's field-23 encoding), and the service's job is just to supply
    that one outer transaction's own balancing inputs/outputs, fee, and
    collateral. "Nest N sub-txs into one tx" and "merge two txs together"
    are different operations, not the same shape wearing different types.

  What *does* carry over is only the idea of "check eligibility, then build,
  then handle errors" as a design principle — not the concrete
  lock/cache/merge mechanics.
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

The API shape and the pricing engine's *design* are genuinely
chain-agnostic — reimplement them, in whatever language a Cardano version
actually settles on, rather than assuming they get imported as TS. Don't
carry over CES's request/response flow shape (lock → build → merge →
respond) at all: CIP-198's service is asynchronous and batch-oriented at a
structural level, not just a different transaction type wearing the same
shape. The transaction-building layer, the batching/pooling logic, and the
on-chain registry all need to be built from scratch, once CIP-198's rules
are finalized.

## Questions for CIP-198

The CIP-198 spec ([full diff](https://github.com/cardano-foundation/CIPs/pull/1257/files))
still has some open parts. Most of them line up with problems
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
  The CIP says an input chosen for a batch "must be held out of selection
  until that build finishes or abandons," and keep collateral fully separate — basically, don't let
  two things spend the same money. Our
  [`UtxoService.lockUtxo`](../apps/server/src/services/utxo.ts) only keeps
  its locks in memory (there's already a `TODO` about this in the code), so
  a restart mid-request can lose a lock and risk a double-spend. This is
  exactly the problem the CIP is warning about.
- **Handling rolled-back blocks — a Cardano requirement, not necessarily a
  Midnight one.** The CIP explains what a service should do if a block it
  already submitted gets reverted — treat the offer as not-yet-included
  again, not as done. CES doesn't handle this at all today, but whether
  that's actually a gap depends on which chain: Midnight's finality is fast
  and comparatively reliable, so this may be a low-priority "confirm it's
  even possible" item on our current codebase, not an urgent fix. On
  Cardano it's not optional at all — rollbacks are routine, ordinary
  behavior there (they happen "even in toy projects," per review feedback on
  this doc), so any real Cardano implementation has to treat rollback
  handling as table stakes from day one, not a CIP-198-specific nicety.
- **The CIP's registry does a lot more than ours.** CIP-198's registry
  isn't just a URL — it's an on-chain record (an NFT) with a
  deposit-weighted random pick for who talks to whom, a published profile
  of what a service accepts, budget limits, and separate price hints served
  over plain HTTP. `packages/registry` today only stores a domain name.
- **Price hints — this one's actually good news.** The CIP deliberately
  keeps a service's rates off-chain, HTTP-served, and non-registered — *"A
  hint is served over HTTP and never registered: it carries a number, and
  numbers move"* — and explicitly non-binding: *"A service that publishes a
  rate has promised nothing and may decline any offer quoted against it."*
  That's basically what
  [`services/quote.ts`](../apps/server/src/services/quote.ts) already
  does — a signed, time-limited quote instead of an on-chain price. We're
  already doing this part the way the CIP recommends.
- **Most of the security section doesn't apply to us, but two bits do.**
  Things like fake registry entries, front-running over a gossip network,
  or fake price hints all assume a network of strangers, which we don't
  have (one client talks to one server directly). Two things are still
  worth a look even so:
  - **Silently dropped requests.** The CIP's mitigation is *canaries*:
    offers indistinguishable from real ones, sent through a peer and
    watched for — if genuinely processed, a canary is posted on-chain and
    pays real fees like any other offer, it isn't a disposable test ping.
    Since we can fall back to a peer server
    ([`sponsor.ts:90-119`](../apps/server/src/services/sponsor.ts#L90)),
    something similar might be worth doing there.
  - **Checking again right before submitting.** The CIP says a service
    must re-check every input it's about to spend right before sending the
    transaction, not just when it first locked it. Worth confirming our
    lock-then-build flow actually does this final check right before
    submit, not only at lock time.

## TODO

The real batch-construction mechanic (the actual point of CIP-198) is blocked
on Dijkstra/CIP-118 landing on a public network — see the section above. 
Everything below is buildable and testable *today*, without it.

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

- [ ] Decide the language/stack for a Cardano implementation *before*
      planning any coding. Nothing forces TS for Cardano the way 
      Midnight's SDK forces it here, and CIP-198's own
      cited prior art (`dmq-node`) is Haskell, not TS.
- [ ] Only if that lands on TS too: extract the genuinely chain-agnostic
      *designs* (pricing/quote engine, metrics, config loading, peer
      discovery) as references to reimplement against, not modules to
      import wholesale — port the approach, not the file.
- [ ] Do not use `sponsor.ts`/`offer.ts`'s lock → build → merge → respond
      shape as a template. It's a poor structural fit for CIP-198's
      asynchronous, batch/pool-oriented model (see the correction above) —
      the only thing worth carrying over is "check eligibility, then build,
      then handle errors" as a principle, not the flow itself.
- [ ] Decide whether this lives as a new package/service next to the
      Midnight one, or a separate repo entirely.

### Explicitly deferred (do not start until Dijkstra ships)

- Any real sub-transaction/batch transaction-building layer (replaces
  `services/tx.ts` and the lock/spend logic in `services/utxo.ts` for a
  Cardano version).
- Anything requiring `field-23` encoding, compositional minimum-fee
  calculation, collateral accounting, or execution-unit accounting for a
  batch.
- The devnet interoperability demonstration CIP-198's own acceptance
  criteria calls for.
