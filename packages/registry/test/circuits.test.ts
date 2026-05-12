import { describe, it, expect } from 'vitest';
import { computeRegistryKey } from '../src/compact-types.js';
import { RegistrySimulator, randomSecretKey, makeRecipient } from './simulator.js';
import { entryFromContract } from '../src/types.js';
import { BASE_TIME, COLLATERAL, MAX_VALIDITY, defaultEntry, futureDate } from './helper.js';

describe('computeRegistryKey', () => {
  it('matches the key stored on-chain by registerServer', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());

    const [onchainKey] = [...sim.getLedger().registry][0];
    const offchainKey = computeRegistryKey(secretKey);

    expect(offchainKey).toEqual(onchainKey);
  });

  it('is deterministic for the same secret key', () => {
    const secretKey = randomSecretKey();
    expect(computeRegistryKey(secretKey)).toEqual(computeRegistryKey(secretKey));
  });

  it('produces different keys for different secret keys', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();
    expect(computeRegistryKey(keyA)).not.toEqual(computeRegistryKey(keyB));
  });

  it('produces a 32-byte output', () => {
    expect(computeRegistryKey(randomSecretKey())).toHaveLength(32);
  });
});

// Verify that the key produced by computeRegistryKey is accepted by the contract's
// deregisterServer circuit — end-to-end validation of the off-chain key derivation.
describe('deregister with computed key', () => {
  it('deregisters the correct entry when key matches', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(1n);

    const registryKey = computeRegistryKey(secretKey);
    sim.deregister(registryKey);

    expect(sim.getLedger().registry.size()).toBe(0n);
  });

  it('collateral is refunded to the specified recipient on deregister', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());

    const registryKey = computeRegistryKey(secretKey);
    const recipient = makeRecipient();
    const effects = sim.deregister(registryKey, recipient);

    let total = 0n;
    for (const [, amount] of effects.unshieldedOutputs) {
      total += amount;
    }
    expect(total).toBe(COLLATERAL);
  });

  it('wrong computed key (from different secret key) cannot deregister active entry', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);
    sim.register(defaultEntry());

    // Switch to keyB so the witness returns keyB's secret key
    sim.useKey(keyB);
    const wrongKey = computeRegistryKey(keyB);

    expect(() => sim.deregister(wrongKey)).toThrow();
  });

  it('can deregister multiple entries each with their own computed key', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    sim.useKey(keyB);
    sim.register(defaultEntry({ address: '_capacityexchange._tcp.other.example.com' }));
    expect(sim.getLedger().registry.size()).toBe(2n);

    sim.deregister(computeRegistryKey(keyB));
    expect(sim.getLedger().registry.size()).toBe(1n);

    sim.useKey(keyA);
    sim.deregister(computeRegistryKey(keyA));
    expect(sim.getLedger().registry.size()).toBe(0n);
  });
});

// claimExpired tests: verify that anyone can deregister an expired entry without a secret key.
describe('claimExpired (deregisterServer on expired entry)', () => {
  it('anyone can deregister an expired entry', () => {
    const ownerKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, ownerKey);
    sim.setBlockTime(BASE_TIME);

    const expiry = futureDate(100n);
    sim.register(defaultEntry({ expiry }));
    expect(sim.getLedger().registry.size()).toBe(1n);

    const registryKey = computeRegistryKey(ownerKey);

    // Advance block time past expiry
    sim.setBlockTime(BASE_TIME + 101n);

    // A different key can now deregister
    sim.useKey(randomSecretKey());
    sim.deregister(registryKey);

    expect(sim.getLedger().registry.size()).toBe(0n);
  });

  it('collateral is refunded to the specified recipient on claim', () => {
    const ownerKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, ownerKey);
    sim.setBlockTime(BASE_TIME);

    const expiry = futureDate(100n);
    sim.register(defaultEntry({ expiry }));

    const registryKey = computeRegistryKey(ownerKey);
    sim.setBlockTime(BASE_TIME + 101n);

    sim.useKey(randomSecretKey());
    const recipient = makeRecipient();
    const effects = sim.deregister(registryKey, recipient);

    let total = 0n;
    for (const [, amount] of effects.unshieldedOutputs) {
      total += amount;
    }
    expect(total).toBe(COLLATERAL);
  });

  it('cannot claim an entry that has not yet expired', () => {
    const ownerKey = randomSecretKey();
    const claimerKey = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, ownerKey);
    sim.setBlockTime(BASE_TIME);
    sim.register(defaultEntry({ expiry: futureDate(100n) }));

    const registryKey = computeRegistryKey(ownerKey);

    // Block time is still before expiry
    sim.useKey(claimerKey);
    expect(() => sim.deregister(registryKey)).toThrow();
  });

  it('can claim multiple expired entries with different keys', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ expiry: futureDate(100n) }));
    sim.useKey(keyB);
    sim.register(
      defaultEntry({
        expiry: futureDate(200n),
        address: '_capacityexchange._tcp.other.example.com',
      })
    );
    expect(sim.getLedger().registry.size()).toBe(2n);

    // Advance past both entries' expiry
    sim.setBlockTime(BASE_TIME + 201n);

    sim.useKey(randomSecretKey());
    sim.deregister(computeRegistryKey(keyA));
    expect(sim.getLedger().registry.size()).toBe(1n);

    sim.deregister(computeRegistryKey(keyB));
    expect(sim.getLedger().registry.size()).toBe(0n);
  });
});

// renewRegistration tests: verify that the circuit updates the on-chain expiry correctly.
describe('renewRegistration circuit', () => {
  it('updates expiry to the new timestamp', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    const initialValidTo = futureDate(100n);
    sim.register(defaultEntry({ expiry: initialValidTo }));

    const newValidTo = futureDate(MAX_VALIDITY);
    sim.renewRegistration(newValidTo);

    const [, raw] = [...sim.getLedger().registry][0];
    const entry = entryFromContract(raw);
    expect(entry.expiry).toEqual(newValidTo);
  });

  it('refresh does not change the registry key or entry count', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ expiry: futureDate(100n) }));

    const [keyBefore] = [...sim.getLedger().registry][0];
    sim.renewRegistration(futureDate(MAX_VALIDITY));
    const [keyAfter] = [...sim.getLedger().registry][0];

    expect(sim.getLedger().registry.size()).toBe(1n);
    expect(keyAfter).toEqual(keyBefore);
  });

  it('refresh does not affect a different entry in the registry', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ expiry: futureDate(100n) }));
    sim.useKey(keyB);
    sim.register(
      defaultEntry({
        expiry: futureDate(200n),
        address: '_capacityexchange._tcp.other.example.com',
      })
    );

    // Only refresh keyB's entry
    const newValidTo = futureDate(MAX_VALIDITY);
    sim.renewRegistration(newValidTo);

    // Find each entry by comparing the stored key against the computed registry keys
    const registryKeyA = computeRegistryKey(keyA);
    const registryKeyB = computeRegistryKey(keyB);

    for (const [storedKey, raw] of sim.getLedger().registry) {
      const entry = entryFromContract(raw);
      if (storedKey.every((b: number, i: number) => b === registryKeyA[i])) {
        // keyA's entry should NOT have been updated
        expect(entry.expiry).toEqual(futureDate(100n));
      } else if (storedKey.every((b: number, i: number) => b === registryKeyB[i])) {
        // keyB's entry should have been updated
        expect(entry.expiry).toEqual(newValidTo);
      }
    }
  });

  it('refresh preserves the address of the entry', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    const entry = {
      expiry: futureDate(100n),
      address: '_capacityexchange._tcp.sundae.fi',
    };
    sim.register(entry);
    sim.renewRegistration(futureDate(MAX_VALIDITY));

    const [, raw] = [...sim.getLedger().registry][0];
    const updated = entryFromContract(raw);
    expect(updated.address).toBe('_capacityexchange._tcp.sundae.fi');
  });
});
