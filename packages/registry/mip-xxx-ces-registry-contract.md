**MIP:** XXXX
**Status:** Proposed  
**Category:** 
**Created:** 2026-05-28  
**Authors:** SundaeSwap
**Language:** Compact ≥ 0.22
**Requires:**
**Replaces:**  
---

<!--
 Copyright 2025 Midnight Foundation

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

## Abstract

This proposal is for a Midnight smart contract to act as an on-chain registry of Capacity Exchange Service (CES) servers. Operators offering dust-fee sponsorship services can register their domain name under a secret key, optionally renew their registration, and reclaim collateral upon deregistering. The public ledger state will be the source of truth of available CES endpoints, instead of central list published else where.

---

## Motivation

The Midnight fee model requires transactions to carry a DUST input. End-users may not have DUST to perform a transaction. CES providers can supply DUST in exchange for an alternative token. However in the current implementation, CES provider URLs are hard-coded into SDKs, or passed as configuration. The risks include:

1. **Centralisation.** Operators not listed in the SDK binary are unreachable.
2. **Stale endpoints.** Updating a hard-coded URL in the SDK requires building a new release.
3. **No operator accountability.** There is no on-chain stake for operators claiming to be a CES provider.

An on-chain registry solves all three problems: discovery is permissionless, entries are self-maintained, and a collateral deposit aligns operator incentives with reliable availability.

---

## Specification

### Types

| Name | Representation | Description |
|------|----------------|-------------|
| `DomainName` | `Bytes<128>` | UTF-8 encoded HTTPS URL (or domain) of the CES endpoint, null-padded to 128 bytes |
| `RegistryKey` | `Bytes<32>` | Public key from the operator's secret key via `hashKey` |
| `DomainNameHash` | `Bytes<32>` | Hash of a `DomainName` used to enforce uniqueness |
| `UnixTimestampSeconds` | `Uint<64>` | POSIX timestamp in seconds |

### Ledger State

| Field | Type | Description |
|-------|------|-------------|
| `registry` | `Map<RegistryKey, Entry>` | Active entries indexed by derived public key |
| `takenDomainNames` | `Set<DomainNameHash>` | Hashes of registered domain names, for uniqueness checks |
| `collateralAmount` | `Uint<128>` | Collateral in native tokens (NIGHT) per registration; set at deploy time |
| `maximumRegistrationPeriod` | `UnixTimestampSeconds` | The longest registration period allowed; set at deploy time |

The `Entry` struct holds the expiry timestamp and the domain name for a single registration:

```compact
struct Entry {
  expiry: UnixTimestampSeconds,
  domainName: DomainName,
}
```

### Constructor

```compact
constructor(requiredCollateral: Uint<128>, maxPeriod: UnixTimestampSeconds)
```

Initialises `collateralAmount` and `maximumRegistrationPeriod`. Both values are disclosed to the public ledger on deployment. These parameters cannot be changed afterwards; each distinct registry instance has its own collateral and period policy.

### Witness

```compact
witness secretKey(): Bytes<64>
```

The operator's 64-byte secret key, supplied locally and never disclosed on-chain. All authenticated circuits derive the operator's `RegistryKey` from this witness via `hashKey`, which applies `persistentHash` with the domain separator `"registry:pkh"`. Only the hash enters the public ledger.

### Circuits

#### `registerServer(entry: Entry)`

Registers a new CES server entry.

**Preconditions checked on-chain:**

1. `entry.expiry` must not be to far from the future than `block_time + maximumRegistrationPeriod`, to prevent long lock-up of collateral.
2. The caller does not already have a key in the `registry` — one registration per secret key.
3. The domain name hash is not present in `takenDomainNames` — enforces global domain name uniqueness.
4. An unshielded NIGHT transfer of exactly `collateralAmount` is received from the caller.

**Effects:** Inserts the key → entry mapping into `registry` and records the domain name hash as taken, in `takenDomainNames`.

#### `deregisterServer(key: RegistryKey, recipient: UserAddress)`

Removes a registration and returns the collateral.

**Preconditions checked on-chain:**

1. `key` is present in `registry`.
2. If the entry has **not yet expired** (`blockTimeLt(entry.expiry)`), the call requires authentication — the caller must prove knowledge of the secret key whose hash equals `key`. 
3. However an expired entry can be removed by **anyone**(permissionless cleanup).

**Effects:** Sends `collateralAmount` NIGHT to `recipient`, removes the domain name hash from `takenDomainNames`, and removes `key` from `registry`.

#### `renewRegistration(expiry: UnixTimestampSeconds)`

Extends the expiry of an existing registration.

**Preconditions checked on-chain:**

1. A registration for the caller's derived key already exists.
2. The new `expiry` satisfies the `maximumRegistrationPeriod` constraint.

**Effects:** Overwrites the existing entry with a new expiry while preserving the domain name.


### Internal Circuits

These circuits are not exported and are only called within the contract.

#### `hashKey(key: Bytes<64>): RegistryKey`

Applies `persistentHash<[Bytes<32>, Bytes<64>]>` with domain separator `"registry:pkh"` to produce the public registry key. Using a domain-separated hash means the same secret key cannot be reused across schemes without producing a distinct commitment.

#### `hashDomainName(domainName: DomainName): DomainNameHash`

Applies `persistentHash<[Bytes<32>, DomainName]>` with separator `"registry:domain-name"`. Stored as a hash rather than plaintext to make the set membership check O(1) and to avoid leaking the full URL through a `Set` membership proof.

---

## Security Considerations

**Secret key confidentiality.** The `secretKey` witness is never disclosed on-chain. If compromised, deregistering a non-expired entry can redirect the collateral to a dubious address; or the entry can be renewed indefinitely. Operators should protect this key.

**Registration race.** Domain names are visible in the mempool before a transaction is confirmed, so a different operator could race to register the same domain with a different secret key. The `takenDomainNames` set ensures the first confirmed registration will win.

**Mass registration abuse.** A malicious party could register many valid and/or invalid entries simultaneously, locking up a huge amount of collateral in the contract. The `maximumRegistrationPeriod` parameter bounds the duration of any single lock-up. Deployers should set `collateralAmount` high enough to make mass registrations a waste of time.

**Expiry-based deregistration race.** Immediately after an entry expires, anyone can deregister the entry. Both the legitimate operator (who intends to renew) and an external watcher (the 'anyone') may submit transactions concurrently. The operator should renew before the expiry, to avoid this race.

---

## Reference Implementation

- Contract source: [packages/registry/contract/src/registry.compact](contract/src/registry.compact)
- TypeScript bindings and client utilities: [packages/registry/src/](src/)
