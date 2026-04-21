# Bridgeless ADA↔DUST Capacity Exchange: Architecture Overview

**Status:** Living draft. Iteratively refined as decisions land

---

## 1. Goal

Let a user holding ADA on Cardano execute a Midnight transaction that requires DUST for gas, by paying ADA to a liquidity provider (LP) who supplies the DUST. **Bridgeless**: no wrapped assets, no full Midnight light client on Cardano. Atomicity comes from pairing a hash-time-locked Cardano escrow with a Midnight intent that atomically requires the same secret to balance. The user's preimage `s` enables both the Midnight-side mint and the Cardano-side claim.

## 2. Parties

- **User** has ADA, wants to land a Midnight tx, doesn't hold DUST.
- **Liquidity Provider (LP)** has DUST, accepts ADA in payment for sponsoring.
- **Relayer** submits the Cardano claim once `s` is on-chain on Midnight. LP can self-relay; a relayer market is also viable.

## 3. Trust model

- **HARD guarantee** (cryptographic): LP cannot claim ADA without delivering DUST.
- **SOFT guarantee** (economic/probabilistic): user can rarely/improbably get DUST without paying ADA.
- **Why asymmetric**: Cardano can verify Midnight finality (BEEFY); the reverse direction is much harder. Here the asymmtery favors the user, as they are paying for the "experience", and an LP can adjust prices to cover the cost of rollbacks. And, perhaps more importantly, DUST is a regenerative asset. So as long as it is hard to manipulate, and the LP isn't hitting DUST capacity limits, there is no value lost.

## 4. Protocol flow (happy path)

1. User picks secret `s`, computes `H = hash(s)`.
2. User locks ADA in a Cardano **escrow UTxO** with a datum including `H`, user's signing key, the LP's address (the only address allowed to receive the claim), amounts, and a timeout `eTTL` (see Timing below). The escrow UTxO is locked at the escrow contract, a single script address per Midnight ledger version. Two spending paths: LP claim (reveal `s` + prove Midnight finality, output pinned to the LP address from the datum) and user refund (after `eTTL`).
3. LP reads state updates from Cardano, filtering for escrow UTxOs at the escrow contract whose datum names this LP (by address). Reads `H` from the datum and validates the agreed terms; ignores escrows with a mismatched LP address or malformed datum.
4. LP builds an **unbalanced transaction** containing `dust_input(LP) + absorb(H)` and shares it with the user. On its own this fragment is invalid; `absorb` requires a token of color `H` that doesn't yet exist. **LP never sees `s`.**
5. User completes the intent by adding `mintReveal(s, H) + user_operation`. The `mintReveal` mints the token of color `H` that LP's `absorb` consumes; the intent now balances. Only the user knows `s`.
6. User signs and submits the completed intent to Midnight.
7. Intent finalizes on Midnight. `s` is permanently in the serialized extrinsic call data.
8. LP (or relayer) submits the Cardano claim with `s` + a finality proof. The validator extracts `s` at a hardcoded byte offset, checks `hash(s) == H`, and pins the output to the LP address read from the escrow's datum. ADA lands.

**Refund path**: user reclaims ADA after `eTTL` if any of steps 5–8 fails. LP's DUST input expires earlier (at `mTTL`, see below), so LP's DUST isn't locked indefinitely.

### Timing

Two separate timeouts govern the protocol:

- **`mTTL`** (Midnight TTL): expiry of the LP's DUST input in the Midnight intent. After `mTTL`, the intent is no longer valid and the LP's DUST is freed.
- **`eTTL`** (escrow TTL): expiry of the user's Cardano escrow UTxO. Between Midnight finalization and `eTTL`, the LP can claim. After `eTTL`, only the original depositor can reclaim.

**Constraint: `eTTL` > `mTTL`** by a reasonable margin (TBD). Otherwise a malicious user could submit the Midnight intent at the very last second of `mTTL`, leaving so little time before `eTTL` that the LP's Cardano claim can't settle in time and the user can refund, taking the DUST without paying. The margin must accommodate Cardano settlement latency plus the BEEFY commitment lag needed to assemble the finality proof.

## 5. Components

### 5.1 Midnight contract
PR #128, branch `prototype/midnight-mint-disclose`. Two circuits:
- `mintReveal(s, h)` — public arg `s`, asserts `hash(s) == h`, mints 1 unshielded token of color `tokenType(h, contract's own address)`.
- `absorb(h)` — receives 1 token of color `tokenType(h, contract's own address)` into the contract.

Ledger balance check is the enforcement: `absorb` alone fails (no supply). Paired with `mintReveal` they net to zero contract holding. This particular contract is just a proof of concept.

### 5.2 Cardano validator
Hash-time-locked escrow (Cardano side only, there is no counterpart HTLC on Midnight; see 5.1 for how the Midnight side enforces co-execution). Two spending paths:
- **Claim** (after Midnight finalization, before `eTTL`): redeemer carries `s` + finality proof; validator extracts `s`, checks `hash(s) == H`, pins output to the LP address read from the escrow's datum.
- **Refund** (after `eTTL`): no proof required, output to user.

The byte offsets where `s` and `H` live in the Midnight extrinsic are **hardcoded into the validator** for the specific Midnight ledger serialization version it targets. See 5.3 for version-handling strategy.

### 5.3 Per-version validator deployment
We deploy **a new Aiken validator per Midnight ledger serialization version**. Each validator hardcodes the byte offsets for its corresponding extrinsic format. When Midnight bumps to a new version, we deploy a new validator; new escrow UTxOs lock at the new address; existing escrow UTxOs continue to claim against their original validator, which still knows its own version's offsets.

The version triple appears in plaintext at the start of every Midnight tx, e.g. `midnight:transaction[v9](signature[v1],proof-preimage,embedded-fr[v1])`. The validator sanity-checks that the prefix matches the version it was built for.

Trade-off: every Midnight ledger version bump requires a new Aiken validator and redeploy. Accepted in exchange for removing the centralization risk of an admin-controlled config UTxO that could mis-set offsets (bricking claims) or be compromised (drain vector). Worst case if we miss a version: new escrow UTxOs locked at an outdated validator can't be claimed by LPs, but users always recover at `eTTL`.

### 5.4 Off-chain coordination
- LP daemon: watches Cardano for new escrow UTxOs at the (versioned) escrow address, filters by datum-specified LP address, validates terms, builds unbalanced transactions, shares with user.
- Relayer: watches Midnight finalized blocks for `mintReveal`, assembles finality proofs, submits Cardano claim.
- Can be the same process; keep them logically separate.

## 6. Cardano-side verification stack

To verify "this Midnight tx revealing `s` actually finalized," the validator processes a layered proof. Each layer maps to known infrastructure:

| Layer | Hash primitive | Reference | Status |
|---|---|---|---|
| BEEFY signature quorum | ECDSA secp256k1 (Plutus builtin) | midnight-node `runtime/src/lib.rs:455` | Trivial during Midnight's federated launch phase (9 trusted operators). Needs sampling once Mōhalu opens validation to Cardano SPOs. |
| MMR inclusion proof | Keccak256 (Plutus builtin) | midnight-node `runtime/src/lib.rs:455` | Plutus builtins make this relatively inexpensive. |
| Block header decode | BlakeTwo256 (Plutus builtin) | Substrate default | Trivial byte parse. |
| `extrinsics_root` trie walk | BlakeTwo256, TrieLayout v1 | `runtime/src/lib.rs:285` (`system_version: 1`) | Needs investigation. No known existing Aiken impl. |
| Byte-extract `s` from extrinsic | none | Hardcoded offset in validator (5.3) | Trivial byte slice. |

**Phase context.** Midnight launched mainnet in a "guarded launch" with 9 federated operators (Worldpay, Bullish, MoneyGram, Pairpoint by Vodafone, eToro, AlphaTON Capital, Google Cloud, Blockdaemon, Shielded Technologies). The planned **Mōhalu** phase onboards Cardano SPOs to validation; validator-set rotation per epoch, capped by `MaxAuthorities = 10000` (midnight-node `runtime/src/lib.rs:1107`). Steady-state committee size is not yet publicly documented.

**Verified offline** by `src/cli/decode-extrinsic.ts`: with `s` as a public circuit arg, `s` lands at a deterministic byte offset (598 in v9 PoC, content-independent). `H` and `recipient` similarly stable across runs.

## 7. Decisions made

| # | Decision | Rationale |
|---|---|---|
| 7.1 | `s` is a public circuit arg, not a witness | Verifier walks `extrinsics_root` (standard Substrate trie, blake2-256) instead of `state_root` → custom Midnight ledger tree (no tooling, custom hash primitive). 10×+ cheaper. |
| 7.2 | Per-version validator deployment, no config UTxO | Removes centralization risk (no admin-controlled offsets table that could brick or be compromised). Worst case is a new ledger version requires a new validator deploy before LPs can claim against it; users always recover at `eTTL`. **Eliminates the drain vector entirely.** |
| 7.3 | Random sampling for BEEFY quorum, with graceful degradation | If validator count ≤ N, verify all (federated phase = 9 → no sampling needed). When count > N, sample N (N is the per-claim sample size, see 8.2). Same contract; switches automatically. |
| 7.4 | Mint+absorb atomicity is the protocol's security property | Proven in PR #128 Test B: `absorb` alone fails on ledger balance check. LP cannot claim ADA without an intent that includes the user's mint. |
| 7.5 | LP builds the absorb-fragment, user adds the mint and submits | LP never sees `s` until it's in the mempool, or on-chain, on Midnight.. Without `s` and a finality proof, LP cannot construct a valid Cardano claim. |
| 7.6 | `eTTL` > `mTTL` with margin for Cardano settlement and BEEFY commitment lag | Defined in 4 Timing. Prevents the late-submit attack where a user delays the Midnight tx until the last second of `mTTL`, leaving the LP without enough time to land their Cardano claim before `eTTL`. Exact margin TBD. |
| 7.7 | LP address lives in the escrow datum, not as a script parameter | One escrow contract address per Midnight ledger version, regardless of how many LPs participate. LPs filter incoming escrow UTxOs by the datum's LP-address field and ignore mismatches. Simpler off-chain (one address per version to watch), simpler deploy (no per-LP parameterization), no security cost — the validator still pins claim outputs to the datum-specified LP. |

## 8. Open decisions / things to investigate

| # | Item | Notes |
|---|---|---|
| 8.1 | **Bias-resistant randomness on Cardano** for sampling | Plutus has no `prevRandao` equivalent. Options: Snowbridge-style commit-reveal across 3 txs, trusted oracle, VRF block nonce as seed. |
| 8.2 | **Sample size N** | Snowbridge formula: `⌈log2(R*V*172.8 / S)⌉` + safety margin. ~30 sigs typical at Polkadot scale. |
| 8.3 | **`mTTL` value** | Short enough that LP's DUST isn't locked indefinitely if the user never submits the intent. Drives 7.6's `eTTL`. |
| 8.4 | **`eTTL` value (and `eTTL − mTTL` margin)** | Must satisfy 7.6 (> `mTTL`, with enough headroom for max BEEFY commitment lag + Cardano settlement). |
| 8.6 | **Hash function compatibility** | Confirm  Midnight's `persistentHash<Bytes<32>>` can be computed (within economic bounds) in Plutus. |
| 8.7 | **Anchor-relative vs absolute offsets in validator** | Absolute byte offsets work today (verified at offset 598). Anchor-relative (e.g., scan for ASCII `mintReveal` then offset from there) more robust to small intra-prefix changes within the same major version. |
| 8.8 | **All-zero `s` fails in `persistentHash`** | Decoder script crashed on `s = 0x00 × 32` ("invalid alignment supplied" from ledger-v8 WASM). Mitigate in user-wallet `randomBytes32` by rejecting zero. |


## 9. Engineering punch list

Approximate ordering. Items marked `‖` can run in parallel. Effort estimates TBD by the implementing engineers.

| # | Task | Depends on |
|---|---|---|
| 1 ‖ | Aiken `extrinsics_root` trie verifier (TrieLayout v1) | — |
| 2 ‖ | Aiken MMR verifier (Keccak256 peaks) | — |
| 3 ‖ | Aiken BEEFY commitment verifier (ECDSA, full quorum at federated) | — |
| 4 | Aiken validator (HTLC paths + verifier glue + hardcoded offsets for current Midnight version) | 1, 2, 3 |
| 5 ‖ | Off-chain LP daemon | |
| 6 | Off-chain relayer | 1–4 done |
| 7 | E2e testnet test (preprod Midnight + preprod Cardano) | All above |
| 8 | Random-sampling design + impl | 8.1, after federated launch |

## 10. Threat model

| Attack | Defense |
|---|---|
| LP claims ADA without providing DUST | Cryptographic: `s` only revealed when intent atomically lands; Midnight balance check forces `mintReveal` + `absorb` co-execution. |
| Observer races LP's claim | Validator pins output to the datum-specified LP address; observer gains nothing. Could optionally tip relayer. |
| **LP front-runs user-broadcast intent's DUST UTxO → mempool-leaks `s` → claims ADA without delivering** | **BEEFY-finality verification on Cardano claim. Without proof of Midnight finalization, mempool `s` is unusable. This is what motivates the entire verification stack in 6.** |
| User delays Midnight submission to the last second of `mTTL` so Cardano can't settle the claim before `eTTL` | `eTTL` > `mTTL` with sufficient settlement margin (4 Timing, 7.6). |
| Midnight reorg removes `s` disclosure | BEEFY signs only finalized blocks (post-GRANDPA); not an issue. |

## 11. References

### Internal
- **PoC contract** (PR #128): https://github.com/SundaeSwap-finance/capacity-exchange/pull/128, branch `prototype/midnight-mint-disclose`, file `prototypes/midnight-mint-disclose/mint_disclose.compact`
- **Offline decoder**(PR #128): https://github.com/SundaeSwap-finance/capacity-exchange/pull/128, branch `prototype/midnight-mint-disclose`, file `prototypes/midnight-mint-disclose/src/cli/decode-extrinsic.ts`

### Midnight node (https://github.com/midnightntwrk/midnight-node)
- Header hashing — `runtime/src/lib.rs:379` (`BlakeTwo256`)
- MMR hashing — `runtime/src/lib.rs:455` (`Keccak256`)
- TrieLayout — `runtime/src/lib.rs:285` (`system_version: 1` → v1)
- BEEFY MaxAuthorities — `runtime/src/lib.rs:1107` (= 10000)
- Pallet entry — `pallets/midnight/src/lib.rs:343` (`send_mn_transaction(_origin, midnight_tx: Vec<u8>)`)

### External
- **Substrate trie reference impl** (Solidity, mechanical port to Aiken): https://github.com/polytope-labs/solidity-merkle-trees
- **Snowbridge sampling docs**: https://docs.snowbridge.network/architecture/verification/polkadot
- **Aiken MPF lib** — NOT compatible with Substrate trie (different encoding); reference only: https://github.com/aiken-lang/merkle-patricia-forestry
- **Substrate trie spec**: https://spec.polkadot.network/chap-state
- **paritytech/trie crate** (canonical Substrate trie): https://github.com/paritytech/trie
- **Cardano Plutus V3 cost model** (`verifyEcdsaSecp256k1Signature` = 43,053,543 CPU steps / 10 mem)

## 12. Iteration log

- **2026-04-20**: Initial version of this architecture document.
