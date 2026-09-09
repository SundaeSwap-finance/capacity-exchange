# CIP-198 alignment — Capacity Exchange

Working notes and task breakdown from comparing Capacity Exchange's sponsor/offer
flow against Cardano's [CIP-198 "Nested Transactions - Service Layer"](https://github.com/cardano-foundation/CIPs/pull/1257),
which specifies the off-chain aggregator infrastructure for babel-fee-style
sub-transactions. Both projects solve the same problem (fund a transaction for a
user with no native fee token), but CIP-198 batches many offers per top-level tx
and lets publishers attach on-chain-checkable constraints; Capacity Exchange
currently does neither. This doc tracks closing that gap, organized by workstream.

Current-state references (as of this review):
- Sponsorship: `apps/server/src/routes/sponsor.ts`, `apps/server/src/services/sponsor.ts`
- Paid offers: `apps/server/src/routes/offers.ts`, `apps/server/src/services/offer.ts`
- UTXO locking: `apps/server/src/services/utxo.ts`
- Registry/discovery: `packages/registry`, `packages/providers`

---

## 1. Batching / aggregation

Today every sponsor/offer request locks one UTXO and merges one dust `Intent`
with one user `Intent` — no pooling across requests. CIP-198's `select_compatible_subset`
+ batch-construction pipeline amortizes fee/UTXO overhead across many offers.

- [ ] Design a request-pooling window (e.g. short debounce per block/slot) that
      collects concurrent sponsor/offer requests before building a tx, instead of
      handling each `POST /sponsor` and `POST /offers` call independently.
- [ ] Define a selection/packing strategy for choosing which pending requests go
      into one batch (start with something like CIP-198's greedy value-density
      default: rank by value/cost, skip anything exceeding a size/ExUnits budget
      or sharing a spent input).
- [ ] Extend `SponsorService`/`OfferService` (`apps/server/src/services/{sponsor,offer}.ts`)
      to merge multiple user `Intent`s into a single dust-funding `Intent` rather
      than 1:1 `merge()`/`bind()` calls.
- [ ] Add a "no overlapping spend inputs across the batch" check analogous to
      CIP-198's `NoOverlappingSpendInputs` ledger rule.
- [ ] Re-validate/re-price the batch against current ledger params immediately
      before submission (CIP-198's "re-simulate against the tip" step), since
      requests may sit in the pool briefly before batching.
- [ ] Benchmark whether batching actually reduces per-user DUST cost enough to
      justify the added latency/complexity — quantify before committing further.

## 2. Client-specifiable constraints / guards

CIP-198 lets a publisher attach a constraint (`PaidAtLeast`, `Guards`, `All`,
`AnyOf`, net-outflow bounds) that the completing batch must satisfy, checked
on-chain via an interpreter script. Capacity Exchange currently has no
client-supplied terms — eligibility and inclusion are entirely server-side
config (`sponsorAll` flag / contract-allowlist in `services/sponsor.ts`).

- [ ] Decide whether Midnight's contract model can support an on-chain-checkable
      guard equivalent, or whether this has to start as an off-chain/protocol-level
      commitment (e.g. signed into the `Quote`) given Midnight's shielded/circuit
      constraints differ from Cardano's Plutus guard model.
- [ ] Add a minimal constraint to the offer flow first (highest leverage, lowest
      risk): let a client require "payment must reach address X for amount ≥ Y"
      before accepting a signed `Quote` — a `PaidAtLeast`-style guarantee.
- [ ] Extend `models/offer.ts` / `models/sponsor.ts` request schemas to carry an
      optional constraint payload.
- [ ] Document known gaps the same way CIP-198 does (e.g. "constraint checked
      off-chain only, still requires trusting the server's tx construction" until/unless
      an on-chain guard becomes feasible).
- [ ] Skip `AnyOf`/`All` composition and bounds language entirely for v1 — start
      with a single required-payment constraint, expand only if there's real demand.

## 3. Liquidity durability

`UtxoService.lockUtxo` (`apps/server/src/services/utxo.ts`) locks UTXOs in an
in-memory LRU cache with an explicit `TODO` about restart durability (line ~37).
CIP-198 treats liquidity strategy as a first-class, persisted concern.

- [ ] Move UTXO lock state out of in-memory LRU into a persisted store (or at
      minimum, reconcile against wallet state on server restart) so a crash
      mid-batch doesn't double-spend or silently drop a lock.
- [ ] Define a liquidity/consolidation policy for the server's own DUST wallet
      (how much to keep spendable vs. consolidated, collateral kept separate) —
      currently undocumented/implicit.
- [ ] Add basic observability: alert when the server's spendable DUST balance
      drops below a threshold, before falling back to peer CES servers becomes
      the default path (`sponsor.ts:90-119`).

## 4. Registry / discovery parity

This is the closest area to CIP-198 already — `packages/registry` provides
on-chain, collateral-backed, DNS-SRV-discoverable server registration, and
`capacityExchangeWalletProvider` supports multiple CES URLs. Lower priority,
smaller gaps only.

- [ ] Compare `packages/registry`'s expiry/collateral model directly against
      CIP-198's [on-chain registration of relays and services] section — check
      for any refund-on-deregister or expiry edge cases CIP-198 handles that
      the current registry contract doesn't.
- [ ] Consider whether a lightweight "service profile" (advertised budgets,
      accepted contract/circuit allowlist, price hints) should be published
      alongside a registry entry, so clients can pick a compatible CES before
      submitting rather than discovering rejection after the fact.
- [ ] No relay-role equivalent exists (CES servers talk directly to each other
      as peers). Confirm this is an intentional simplification and not a gap
      worth closing — likely fine at current scale.

## 5. Documentation

- [ ] Once any of the above lands, add a short architecture note (in
      `packages/providers/README.md` or a new `docs/` page) describing how
      Capacity Exchange's model maps to / diverges from CIP-198, for future
      contributors who know one but not the other.
