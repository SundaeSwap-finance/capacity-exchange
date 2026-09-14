# CIP-198 alignment — Capacity Exchange

Notes from comparing Capacity Exchange to Cardano's [CIP-198](https://github.com/cardano-foundation/CIPs/pull/1257)
("Nested Transactions - Service Layer"). CIP-198 is the design for a service
that collects transactions that can't pay their own fee ("babel fee offers")
and bundles them into one valid transaction it pays for. Capacity Exchange
does the same job for Midnight (paying DUST for users who have none), so the
two are good reference points for each other.

Re-checked against the CIP-198 PR (still open, unchanged as of this pass) and
against the current server code, 2026-09-14.

Where things live today:
- Sponsorship (free): `apps/server/src/routes/sponsor.ts`, `apps/server/src/services/sponsor.ts`
- Paid offers: `apps/server/src/routes/offers.ts`, `apps/server/src/services/offer.ts`
- UTXO locking: `apps/server/src/services/utxo.ts`
- Registry/discovery: `packages/registry`, `packages/providers`

---

## 1. Batching (questionable — needs a decision, not just a build)

CIP-198 exists because its offers travel over an open gossip network with no
fixed client-server pairing, so a service has to pool many offers from
strangers before it can build anything. Capacity Exchange isn't built that
way: a client calls one server directly and gets a ready-to-submit transaction
back in the same response. Introducing a batching/pooling window would mean
making that response wait for other unrelated requests — trading latency for
savings on DUST cost.

- [ ] Decide if batching is worth it at all before designing it. Measure how
      much of a sponsored/offer transaction's DUST cost is actually
      per-request overhead vs. work the batching couldn't shrink anyway.
- [ ] If it is worth it: only for a case where a short delay is acceptable
      (e.g. a background top-up), not for real-time sponsor/offer requests.
- [ ] If pursued, borrow CIP-198's approach: rank pending requests by a
      value/cost score, take them greedily until a size or execution-unit
      budget is hit, skip anything that would reuse an input already claimed.
- [ ] Whatever gets batched still needs a final re-check against the current
      chain state right before submitting (CIP-198 calls this
      "re-simulate against the tip") — a request can go stale while it waits.

## 2. Letting a client attach conditions to their request

CIP-198 lets the party sending in a transaction attach a rule the finished
batch must satisfy — e.g. "an output of at least X must go to address Y" —
and that rule is checked on-chain, not just trusted. Capacity Exchange has no
version of this today: what gets accepted and how it's built is entirely
server-side config (an allowlist of contracts/circuits), and the client just
gets back a transaction it has to trust was built correctly.

- [ ] Check whether Midnight's contract/proof model can even express an
      on-chain-checked condition like this — Plutus guards don't have a
      direct Midnight equivalent, so this may only be possible as an
      off-chain promise for now (e.g. built into the signed `Quote`), not an
      enforced one.
- [ ] If so, start small: one condition only — "my payment must reach this
      address for at least this amount" — on the paid-offer flow
      (`models/offer.ts`), not the combinator language (`All`/`AnyOf`) CIP-198
      defines for the open-network case, which Capacity Exchange doesn't need.
- [ ] Be explicit in docs about which parts are enforced vs. just promised, so
      "trust the server" isn't silently assumed.

## 3. UTXO locks don't survive a restart

`UtxoService.lockUtxo` (`apps/server/src/services/utxo.ts:37-38`) keeps its
locks in an in-memory cache — there's already a `TODO` in the code about
this. If the server restarts mid-request, a lock is just gone with no record
it existed.

- [ ] Persist lock state (or at least reconcile it against the wallet's real
      UTXO set on startup) so a restart can't double-spend a UTXO that was
      mid-lock.
- [ ] Write down the server's own liquidity policy — how much DUST it keeps
      spendable vs. consolidated — since CIP-198 treats this as something a
      service must define, and right now it's implicit/undocumented here.
- [ ] Add an alert for low spendable DUST balance, ahead of it silently
      falling back to a peer CES server (`sponsor.ts:90-119`).

## 4. Chain rollbacks (missing — not currently handled at all)

CIP-198 spends a whole section on what a service must do if the chain rolls
back a batch it already submitted: put the offer back to "verified", allow it
to be re-included, don't treat a rolled-back confirmation as final. Capacity
Exchange's server has no equivalent — grep for rollback/reorg handling in
`apps/server/src` turns up nothing.

- [ ] Confirm whether this is actually a real risk on Midnight (depends on its
      finality model) before building anything — if Midnight's finality makes
      rollbacks effectively impossible in practice, this item can be closed
      as "not applicable" rather than built.
- [ ] If it is a real risk: define what happens to a locked UTXO and an
      already-returned transaction if the block it lands in gets rolled back.

## 5. Registry / discovery — closest match already, small gaps only

`packages/registry` already does what CIP-198's registration section asks
for: an on-chain entry, collateral locked to register, refunded on
deregistration, expiry that lets anyone reclaim the collateral. This is the
one area where Capacity Exchange is already CIP-198-shaped.

- [ ] CIP-198 registrations also carry a published "service profile" — what a
      service will accept, its budgets/limits, which constraint versions it
      supports — so a client can pick a compatible service *before* trying
      it. Capacity Exchange's registry only carries a domain name today.
      Consider whether publishing even a minimal profile (accepted
      contracts/circuits, a rough budget) is worth it, so a client doesn't
      have to try-and-fail against a server to learn its limits.
- [ ] CIP-198 has a third role, "relay" (forwards offers, doesn't build
      anything) alongside services. Capacity Exchange has no relay
      equivalent — servers that are short on funds call each other directly
      as peers instead. This looks like an intentional, reasonable
      simplification for now, not a gap — flagging so it's a conscious
      choice, not an oversight.

## 6. Racing for the same request — doesn't apply here (worth stating explicitly)

CIP-198 spends significant space on offer competition: the same offer can be
gossiped to many services, more than one might try to include it, and only
the first to land on-chain wins (the rest wasted their work). Capacity
Exchange doesn't have this problem — a client picks one server, calls it
directly, and gets one transaction back synchronously. There's no gossip
step and nothing to race. No action needed here; noting it so nobody spends
time solving a problem Capacity Exchange's design doesn't actually have.

## 7. Documentation

- [ ] Once anything above lands, add a short note (in
      `packages/providers/README.md` or a new docs page) explaining how
      Capacity Exchange's design maps to and differs from CIP-198, for anyone
      who knows one but not the other.
