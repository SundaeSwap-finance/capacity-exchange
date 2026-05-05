# Bridgeless ADA/DUST Capacity Exchange Architecture

This document covers the *why*, the *what*, and the *high-level architecture* of the bridgeless ADA→DUST capacity exchange. Implementation choices (concrete byte layouts, library selection, daemon process structure, hash-function ports, sampling formulas) are left to the engineers building it.

---

## 1. Problem

A user holding ADA on Cardano needs to execute a transaction on Midnight that requires DUST for gas. They do not hold DUST and don't want to bridge into a wrapped asset. The existing capacity-exchange SDK already supports paying for Midnight gas with non-DUST tokens *already on Midnight*; this design adds a new swap mode where the source asset lives on a different chain.

**"Bridgless"** means there are no wrapped assets on Midnight, a cardano transaction facilitates a Midnight transaction, and vice versa. These swaps cannot be *atomic*, due to rollbacks and Cardano reorgs, but it is designed to nearly guarantee that the user who pays for a service receives that service. DUST is a regenerative asset, so failure modes where the LP delivers DUST without getting paid are tolerable (and can be handled by the LP adjusting prices). Failure modes where the user pays without receiving service are not. The design pairs a hash-time-locked contract (HTLC) on Cardano with a contract on Midnight that harnesses the ability to merge transactions. The cross-chain leg from "transaction finalized on Midnight" to "ADA claimed on Cardano" remains a sequenced settlement with bounded risk.

## 2. Goals and non-goals

**In scope**

- Probabilistic ADA-on-Cardano → DUST-on-Midnight settlement for a single user-initiated swap, with failure modes that favor the user receiving service.
- Cryptographic property that an LP cannot claim ADA without the user's secret being revealed on Midnight (which guarantees that the user receives their service before completing payment).
- Permissionless participation: any party meeting the protocol's terms may act as an LP, and any party may submit the Cardano claim.
- Recovery path that returns the user's ADA on the dominant failure paths.
- Integration with the existing capacity-exchange SDK and `/prices` discovery surface.

## 3. Roles

- **User.** Holds ADA, wants to land a Midnight transaction. Most likely interacting through a **dApp** that integrates the SDK, though not necessarily.
- **LP.** Holds DUST. Operates off-chain infrastructure that watches Cardano for new escrows, validates terms and builds unbalanced Midnight transactions.
- **Relayer.** Whoever broadcasts the Cardano claim transaction. The LP is the *de facto* relayer, but the validator places no constraint on relayer identity; anyone can relay, paying their own Cardano fees, but receives nothing from the protocol.
- **SDK.** This repository. Owns secret generation, escrow construction, transaction assembly and merging on the user side, and refund logic. The SDK is the integration layer; dApps consume it.

## 4. Trust model

**Priority: the user who pays receives the service.** Cross-chain settlement is probabilistic, not atomic, so no construction can make this absolute. The design optimizes for this outcome by making the user's ADA recoverable on the dominant failure paths and aligning the LP's economic incentives with serving rather than declining.

**Cryptographic property.** The LP cannot claim ADA without the user's secret `s` becoming observable on Midnight. This guarantees that the user has at least *submitted* a transaction on Midnight that completes their intended operation. Combinining this with a BEEFY justification guarantees that the transaction has *finalized* on Midnight before the LP is able to claim the payment.

**Why this asymmetry is acceptable.** Cardano can verify Midnight finality relatively cheaply (via BEEFY); the reverse direction is much harder. Aligning the strong cryptographic guarantee with the side where verification is cheap is sensible. More importantly, **the loss profiles are asymmetric**. DUST is a regenerative asset and free to provide while the LP is below saturation: an LP that delivers DUST and doesn't get paid has an opportunity cost, not a principal loss. A user that pays ADA and doesn't get service loses real money. Putting the strongest protections on the user side matches where the irrecoverable loss can actually occur.

## 5. The construction

A Midnight transaction is an atomic ledger update. It can contain many intents (individual operations such as token movements, DUST inputs, or contract circuit calls), and finalizes only if the whole set balances: every receive of a token must be matched by a send of the same color somewhere in the same transaction. The merge primitive lets the LP and the user each construct a transaction independently, neither of which has to balance on its own, and then combine them into one transaction that does.

The user commits **two** secrets, `s` and `s'`, when they create the Cardano escrow. Both hashes, `h = hash(s)` and `h' = hash(s')`, go into the datum. `s` is the *public* secret: it ends up disclosed verbatim in the on-chain Midnight extrinsic call data so the Cardano validator can verify it directly. `s'` is the *private* secret: it stays in the user's possession and is fed to the Midnight contract through a **witness function**. Midnight's witness mechanism lets a circuit consume `s'` inside the ZK proof, attesting that the user knows it and that derived values are computed correctly, without `s'` itself ever appearing on chain.

This design uses two contract circuits:

- **`mintReveal(s)`** — `s` is a public (disclosed) circuit argument; `s'` is read inside the circuit via a witness function. The circuit mints one unshielded token of color `hash(hash(s) || hash(s'))`.
- **`absorb(h, h')`** — both arguments are public. The circuit receives one token of color `hash(h || h')` into the contract.

The two-party Midnight flow:

1. The **LP** builds an unbalanced transaction containing `dust_input(LP) + absorb(datum.h, datum.h')`. The two `absorb` arguments come straight from the on-chain Cardano datum and are public. The transaction is unbalanced — `absorb` claims a token of color `hash(h || h')` and there is no matching supply.
2. The **user** builds their own unbalanced transaction containing `mintReveal(s) + user_operation`. The mintReveal call carries `s` publicly and uses the user's witness function to feed `s'` into the proof. The mint's color is `hash(hash(s) || hash(s'))`.
3. The user **merges** the LP's transaction with their own. The merged transaction balances *if and only if* `hash(hash(s) || hash(s')) == hash(h || h')` — i.e., `hash(s) == h` and `hash(s') == h'` (assuming hash collision resistance). The Midnight ledger's balance check enforces this match. When it holds, `mintReveal`'s supply is consumed by `absorb`, the LP's DUST input pays gas, and `user_operation` runs.
4. The user signs the merged transaction and submits it. Once finalized, `s` is public in the extrinsic call data; `s'` is not.

**Why two secrets, and what that buys.** A single-secret form is vulnerable to LP front-running: an LP can read `s` from the user's mempool transaction, build a competing transaction `dust_input(LP) + mintReveal(s) + absorb(h)` that omits `user_op`, finalize the same `s` on Midnight, and claim ADA without delivering the user's intended operation. Net economic for the LP is zero (DUST out, ADA in, same as the honest flow), but censorship of `user_op` is real value when the user's operation is competitive (an arbitrage, a liquidation, etc.).

The two-secret form closes that. Constructing `mintReveal` requires the witness `s'` — without it, the ZK prover cannot produce a valid proof for the circuit. An LP that has only `s` from the mempool cannot generate a competing `mintReveal`. Substituting an `s'_LP` of the LP's own choosing fails too: the resulting mint color is `hash(hash(s) || hash(s'_LP))`, which does not match the absorb color `hash(h || h')` that the validator's `h'` check forces. The LP would need a preimage of `datum.h'`, i.e., the user's secret `s'`, and preimage resistance prevents that.

This is the property the Cardano side leans on. Given a proof that a Midnight extrinsic finalized, contains `s` such that `hash(s) == datum.h`, *and* was paired with an `absorb` whose second argument equals `datum.h'`, the Cardano validator releases ADA. There is no path for the LP to produce such an extrinsic without the user's witness `s'`, and no path for the extrinsic to land without a matching `absorb` consuming the LP's DUST. The LP's DUST delivery, the disclosure of `s`, and the binding to *this* user's `(h, h')` commitments are inseparable.

A bridge-based design would need to prove state inclusion via several layers: signed commitment → MMR root → block header → storage trie → contract membership. This design needs a single Substrate Patricia trie inclusion proof for the extrinsic in `extrinsics_root`. The Midnight ledger's transaction-level atomicity, the merge primitive, and the witness-based binding to `s'` carry the rest.

## 6. Protocol

### 6.1 Happy path

The flow involves four actors and three chains' worth of state (Cardano UTxO set, Midnight extrinsics, the off-chain LP channel). Numbered steps below correspond to numbered events in the sequence diagram.

```mermaid
sequenceDiagram
    participant User as User (via SDK)
    participant Cardano
    participant Midnight
    participant LP

    Note over User: (1) generate s, s'<br/>h = hash(s), h' = hash(s')
    User->>Cardano: (2) escrow(h, h', lp_address, eTTL, amount)
    Cardano-->>LP: new escrow observed
    Note over LP: (3) validate terms<br/>build unbalanced tx:<br/>dust_input(LP) + absorb(h, h')
    LP-->>User: LP unbalanced tx (off-chain)
    Note over User: (4) build mintReveal(s) [witness s'] + user_op<br/>merge with LP tx; sign; submit
    User->>Midnight: merged tx
    Note over Midnight: (5) finalize; s now in call data
    LP->>Cardano: claim(s, finality_proof)
    Note over Cardano: (6) verify proof<br/>pin output → lp_address
```

1. **Secrets.** The SDK generates two 32-byte secrets from a CSPRNG: `s` (public secret, will be disclosed on Midnight) and `s'` (private secret, will be supplied as a witness to the Midnight contract). Computes `h = hash(s)` and `h' = hash(s')`.
2. **Escrow.** The SDK constructs a Cardano escrow UTxO. The datum names `h`, `h'`, the user's refund credential, the LP's full Cardano address, the agreed amounts, and `eTTL` (Cardano slot deadline).
3. **LP transaction.** The LP observes the escrow on Cardano (after waiting enough confirmations to be reorg-safe), validates that the datum's terms match what was quoted, and constructs an unbalanced Midnight transaction containing a DUST input from the LP plus an `absorb(datum.h, datum.h')` call. Sent to the user via off-chain channel.
4. **Merge and submit.** The SDK builds the user's own unbalanced transaction containing `mintReveal(s) + user_operation` (the witness function inside the circuit returns `s'`), merges it with the LP's transaction, signs, and submits the merged transaction to a Midnight node. The merge balances: `mintReveal`'s color `hash(hash(s) || hash(s'))` matches `absorb`'s color `hash(h || h')`, the LP's DUST pays gas, and `user_operation` runs. `s` is readable from any node's local mempool from this point onward; `s'` is not — the witness stays in the user's possession and is never written to chain.
5. **Finalize.** Midnight processes the merged transaction through GRANDPA finality and BEEFY commitment. `s` is now public in the extrinsic's call data on a finalized block.
6. **Claim.** The LP (or any relayer) constructs a Cardano transaction that consumes the escrow, supplying `s` and a finality proof in the redeemer. The validator confirms two facts against the finalized Midnight extrinsic: `hash(s) == datum.h` (extracted from `mintReveal`'s public arg), and the second `absorb` argument equals `datum.h'` (extracted from `absorb`'s public args). It then pins the entire `amount_ada` output to `datum.lp_address`.

The off-chain channel in step 3 is implementation-defined — likely an extension of the existing `/prices` infrastructure. The protocol does not prescribe its shape; it only requires that the LP can deliver its unbalanced transaction to the SDK before `mTTL` (see section 7) elapses.

### 6.2 Refund path

If the swap fails to complete by `eTTL` for any reason, LP unresponsive, Midnight transaction fails to finalize, BEEFY infrastructure unavailable, network partition, the user reclaims ADA. The Cardano validator accepts a transaction that has a validity range starting after `datum.eTTL` and is signed by `datum.user_signing_key`. No proof, no destination constraint.

The LP's DUST input has its own, earlier expiry (`mTTL`), so the LP's capital isn't locked until the user's deadline.

## 7. Timing

Two timeouts and one operational parameter govern the protocol. Specific values are LP- and integrator-tunable; the architecture specifies the constraint structure, not the numbers.

| Parameter | Lower bound from | Upper bound from | Notes |
|---|---|---|---|
| `cardano_wait_depth` | Cardano reorg resistance for the escrow deposit | LP eagerness to serve | How many Cardano confirmations the LP requires before serving an escrow. Operational; outside protocol scope. |
| `mTTL` | Midnight finalization latency + buffer | LP's tolerance for capital lockup on the unsubmitted leg | Window in which the user must submit the merged transaction and Midnight must finalize. After `mTTL`, the LP's DUST input is no longer valid in the transaction and the LP's capital is freed. |
| `eTTL` | `mTTL` + worst-case BEEFY commitment lag + Cardano settlement + safety | User's tolerance for ADA lockup on the unhappy path | Cardano-side deadline. Before `eTTL`, only the LP's claim path is valid; after, only the user's refund path. |

**Hard constraint:** `eTTL > mTTL` by enough margin to cover the worst-case BEEFY commitment lag (mandatory commitments at session boundaries on Midnight are on the order of tens of minutes) plus Cardano settlement and safety. Without this margin, a user who delays Midnight submission until the last second of `mTTL` could leave the LP without enough time to land a Cardano claim before `eTTL`, allowing the user to refund and effectively get DUST for free.

## 8. High-level architecture

The system has four buildable pieces. The boundary between them is what this section describes; what's *inside* each piece is implementation territory.

### 8.1 Midnight contract

A small Compact contract exposing two circuits, `mintReveal(s)` and `absorb(h, h')`. The contract uses a witness function to read the user's private `s'` inside `mintReveal` without disclosing it on chain; the ZK proof attests that the prover knows `s'` and that the resulting mint color is computed correctly. Token color is `hash(hash(s) || hash(s'))` for the mint and `hash(h || h')` for the absorb, so the merged transaction's balance check forces `(hash(s), hash(s')) == (h, h')`. Semantics are described in section 5. A working PoC is `mint_disclose.compact` in this directory, with end-to-end scenarios in `src/cli/e2e.ts` covering the four cases below. (In Compact code, `h'` is a valid identifier such as `hPrime`; this document uses `h'` for readability.)

The PoC's e2e harness exercises four scenarios:

- **A.** `mintReveal(s)` alone succeeds; `s` lands in the disclosed-preimages ledger keyed by `hash(s)`.
- **B.** `absorb(h, h')` alone with random arguments fails on the balance check (no matching supply).
- **C.** `mintReveal(s) + absorb(hash(s), h')` in a single merged transaction with `h' == hash(s')` succeeds; the mint and absorb colors match.
- **C′.** `mintReveal(s) + absorb(hash(s), h'_wrong)` with a wrong `h'` fails on the balance check; the mint color (using witness `s'`) and the absorb color (using `h'_wrong`) differ. This is the load-bearing demonstration of the LP-front-run defense.

### 8.2 Cardano validator

A Plutus validator backs the escrow address. One validator per Midnight ledger serialization version (see section 9 on per-version deployment). Two spending paths: claim and refund.

The escrow datum is the contract between the SDK and the validator:

| Field | Type | Notes |
|---|---|---|
| `h` | `Bytes32` | `hash(s)` commitment to the public secret disclosed in `mintReveal` |
| `h_prime` | `Bytes32` | `hash(s')` commitment to the private witness secret. Used by the LP as the second `absorb` argument and verified on-chain by the Cardano validator. Closes the LP-front-run vector (see section 5). |
| `user_signing_key` | `KeyHash` (28B) | refund-path authentication |
| `lp_address` | `Address` | full Cardano address (payment + stake credentials); claim output target |
| `amount_ada` | `u64` | claim output value, lovelace |
| `amount_dust` | `u64` | redundant on-chain (Midnight enforces the LP's DUST cost via the transaction) but kept for visibility |
| `eTTL` | `u64` | Cardano slot deadline |


**Claim path** (before `eTTL`). The redeemer carries `s` and a BEEFY-anchored finality proof. The validator:

1. Reads the trusted authority set and signer threshold from the `committee_bridge` and `beefy_signer_threshold` NFTs (reference inputs).
2. Verifies the signed BEEFY commitment against the authority set: multi-member Merkle proof of signers, ECDSA signatures over the SCALE-encoded commitment, stake sum at or above threshold.
3. Extracts the MMR root from the commitment payload (or, equivalently, from the target block's `BEEF` consensus digest; the header carries it directly via `ConsensusLog::MmrRoot`, so if we have the target block's header we can skip the commitment-payload path).
4. Verifies MMR inclusion of the target block's leaf in that root.
5. Verifies the supplied block header bytes hash (BlakeTwo256) to the MMR leaf's `parent_hash`.
6. SCALE-decodes the header, extracts `extrinsics_root`.
7. Verifies the supplied extrinsic's inclusion in `extrinsics_root` via a Substrate Patricia trie proof (TrieLayout v1).
8. Sanity-checks the extrinsic's ledger-version prefix against what this validator was built for.
9. Byte-extracts `s` from `mintReveal`'s public arg and the two `absorb` arguments (`h`, `h'`) at hardcoded offsets. Asserts `hash(s) == datum.h`, the extracted first absorb arg equals `datum.h`, and the extracted second absorb arg equals `datum.h_prime`. The third check is the front-run defense: it forces any finalized claim-eligible transaction to bind to the user's specific `(h, h')` commitments, which only the user could construct (via the witness function for `s'`).
10. Constrains the transaction's outputs and validity range: the entire `datum.amount_ada` is pinned to `datum.lp_address`, and the validity range ends before `datum.eTTL`.

The validator does not constrain relayer identity. Anyone may relay; the output goes to the LP regardless.

**Refund path** (after `eTTL`). Validity range starts after `datum.eTTL`; transaction is signed by `datum.user_signing_key`. No proof, no destination constraint.

### 8.3 SDK

Responsibilities:

- Generate `s` and `s'` (CSPRNG, 32 bytes each), enforce uniqueness across the user's active escrows, and surface the resulting `h = hash(s)` and `h' = hash(s')` to the rest of the flow.
- Construct the Cardano escrow transaction with the canonical datum.
- Hold `s'` privately in user-side state for the duration of the swap; expose it to the Midnight contract only via the witness function during `mintReveal` proof generation.
- Receive the LP's unbalanced transaction, build the user's own transaction containing `mintReveal(s) + user_operation` (with `s'` supplied as witness), merge them, sign, and submit to Midnight.
- Construct the Cardano refund transaction when invoked after `eTTL`.

Integrators are dApps (any application requiring Midnight transactions), not specifically wallets. The SDK does not prescribe a wallet integration; it exposes signing hooks and lets the dApp wire them up.

### 8.4 LP infrastructure

An off-chain process (logically a single service, separable into "watcher" and "claim relayer" roles):

- Watches the per-version escrow address on Cardano. Filters incoming UTxOs by the datum's `lp_address` field.
- Validates each escrow's terms against expected pricing.
- After enough Cardano confirmations, builds an unbalanced transaction and delivers it to the SDK over the off-chain channel.
- Watches Midnight for the resulting transaction's finalization, assembles the BEEFY-anchored finality proof, and submits the Cardano claim.

How the LP keeps Cardano and Midnight state in sync, sources BEEFY commitments, and manages multi-chain syncing is implementation-defined.

### 8.5 Cardano-side BEEFY infrastructure

The validator's claim path verifies a layered Midnight finality proof: a BEEFY signature quorum over a commitment, MMR inclusion of the target block, header decoding, and Substrate Patricia trie inclusion of the extrinsic in `extrinsics_root`. Each layer is verifiable in Plutus; the design leans on Cardano-side BEEFY infrastructure (`midnight-reserve-contracts`) for authority tracking and signature primitives, and ports the trie verifier from existing reference implementations.

## 9. Per-version validator deployment

The validator hardcodes byte offsets for one specific Midnight ledger serialization version. When Midnight bumps the version, a new validator deploys; new escrow UTxOs lock at the new address; existing escrow UTxOs continue to claim against their original validator.

This trades a per-version redeploy cycle against the centralization risk of an admin-controlled config UTxO that could mis-set offsets (bricking claims) or be compromised (drain vector). The trade is favorable: the worst case if a version is missed is that LPs can't claim against new escrows at the outdated validator, but users always recover at `eTTL`. There is no scenario where ADA gets stolen.

Anchor-relative offset extraction (scanning extrinsic bytes for a stable anchor and reading offsets relative to it) is a long-tail robustness improvement that would let one validator survive intra-version drift. Deferred for now.


## 10. Threat model

Defenses below assume protocol invariants hold (Midnight transaction atomicity, BEEFY signs only post-GRANDPA-finalized blocks, Cardano consensus security).

| Attack | Defense |
|---|---|
| LP claims ADA without delivering DUST. | Cryptographic. The Cardano claim requires a finalized Midnight extrinsic containing `mintReveal(s)` whose mint color matches a balancing `absorb(h, h')`. The Midnight ledger's balance check rejects any transaction containing the absorb without a matching mint, and the validator's check that `absorb`'s second argument equals `datum.h_prime` forces the matching mint to be over the user's specific `(h, h')` commitments. The LP cannot produce a finalized extrinsic satisfying both checks except by participating in a transaction that delivers DUST. |
| Observer races the LP's claim submission. | Output is pinned to `datum.lp_address`; observer pays Cardano fees and gets nothing. |
| LP front-runs the user's broadcast transaction: extracts `s` from mempool, broadcasts a competing transaction omitting `user_op`, claims ADA without delivering the user's intended operation. | **Cryptographic.** Constructing `mintReveal` requires the witness `s'`, which the user holds privately and never writes to chain. The LP can read `s` from the mempool but has no way to obtain `s'` (preimage of `datum.h_prime`), so they cannot generate a valid `mintReveal` proof. Substituting an `s'_LP` of their own choosing fails the validator's check that `absorb`'s second argument equals `datum.h_prime`. See section 5 for the full argument. |
| User delays Midnight submission to the last second of `mTTL`, leaving insufficient time for the LP's Cardano claim to settle before `eTTL`. | `eTTL > mTTL` by a margin covering worst-case BEEFY commitment lag plus Cardano settlement (section 7). Implementation owns specific values; constraint structure is fixed. |
| User reuses `(s, s')` across multiple escrows (so `h` and `h'` are both duplicated). After one swap finalizes and reveals `s`, the named LP of any duplicate escrow can submit the same finalized extrinsic as their claim — `hash(s) == datum.h` and `absorb`'s second argument equals `datum.h_prime` for the duplicate too. They get paid without having delivered DUST for that escrow. | Self-grief only. The user pays multiple LPs for one delivered service; no third-party theft (each escrow's output goes only to its own datum's `lp_address`). SDK-level safeguard against secret-pair reuse — fresh `(s, s')` per escrow. Reusing only one of the two (different `s'` per escrow) doesn't enable this attack; the validator's `h_prime` check prevents cross-escrow claim reuse when `s'` differs. |
| Midnight reorg removes `s` disclosure. | BEEFY signs only post-GRANDPA-finalized blocks. Reorg of a finalized block is not in the threat model. |
| BEEFY infrastructure unavailable (no justifications produced, or `committee_bridge` not maintained). | Liveness, not security. Claim path can't be assembled; in-flight escrows refund at `eTTL`. LP eats the DUST loss. See section 11. |
| Extrinsic-format drift within a Midnight ledger version. | Detectable in CI / pre-deploy by re-running offset verification. Failure mode is bounded: new escrows at an outdated validator can't be claimed by LPs, but users always recover at `eTTL`. |

## 11. Open items requiring resolution before v1

These block deploy. Implementation-tier opens (sampling formulas, hash-function ports, anchor-relative offsets, payload-ID verification against a live commitment) are tracked separately by the implementing team.

- **BEEFY justification sourcing.** Public Midnight RPCs do not currently serve BEEFY justifications; the LP/relayer needs a working source.
- **`committee_bridge` NFT operational status on the target network.** Even with justifications produced, the on-chain authority tracker must be bootstrapped with the genesis authority set and updated each rotation. Either verify Midnight is doing this, or commit to running the relayer ourselves.
- **Offset measurement under realistic transaction shapes.** The current measurement was verified against a minimal test transaction. The production shape is the merged transaction containing an LP dust input, `absorb(h, h')`, `mintReveal(s)` (with `s'` supplied via witness), and the user's `user_op`. The validator extracts `s` plus both `absorb` arguments at hardcoded offsets, so all three offsets need to be re-measured against compound transactions (multi-op, shielded+unshielded mixes, mixed contract calls) before a v1 validator is committed.
- **End-to-end exercise of the witness path on preprod.** The PoC contract and tests are in place locally (`mint_disclose.compact` plus `src/cli/e2e.ts`); the witness-function path needs to be run against a live network to confirm the merged-transaction flow finalizes and that the absorb arguments land at predictable byte positions (the offset measurement noted above).
- **Substrate Patricia trie verifier in Aiken.** No known existing implementation. Mechanical port from the Solidity reference is the leading approach.

## 12. Success criteria for v1

The protocol is v1-ready when:

1. End-to-end swap completes on Midnight preprod and Cardano preprod, including the BEEFY-anchored claim path against a real BEEFY commitment from Midnight preprod.
2. The Plutus validator is deployed for the current Midnight ledger version with verified offsets, full BEEFY/MMR/extrinsics-root verification, and refund-path behaviour exercised end-to-end.
3. The SDK exposes a public surface that takes a target Midnight transaction plus an LP quote and produces the escrow tx, the merged Midnight transaction, and a refund tx, with secret generation, hashing, and uniqueness handled internally.
4. Documentation enables a third-party LP to onboard without *requiring* source-level access to the SDK internals.

## 13. References

- **PoC contract** — `mint_disclose.compact` in this directory (PR #128 on `prototype/midnight-mint-disclose`).
- **Offline extrinsic decoder** — `src/cli/decode-extrinsic.ts` in this directory.
- **midnight-node** — https://github.com/midnightntwrk/midnight-node (BEEFY, MMR, trie layout, payload IDs).
- **midnight-reserve-contracts** — https://github.com/midnightntwrk/midnight-reserve-contracts (Cardano-side BEEFY authority tracker; design reuses the on-chain NFTs and the relevant Aiken modules).
- **Substrate trie reference impl (Solidity)** — https://github.com/polytope-labs/solidity-merkle-trees (port target for the Aiken `extrinsics_root` verifier).
- **Snowbridge sampling docs** — https://docs.snowbridge.network/architecture/verification/polkadot (BEEFY signature sampling once Mōhalu opens validation).
- **Substrate trie spec** — https://spec.polkadot.network/chap-state.
