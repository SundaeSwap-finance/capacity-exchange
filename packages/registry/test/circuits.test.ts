import { describe, it, expect } from 'vitest';
import { computeRegistryKey } from '../src/circuits/deregister.js';
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
    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(2n);

    sim.deregister(computeRegistryKey(keyB));
    expect(sim.getLedger().registry.size()).toBe(1n);

    sim.useKey(keyA);
    sim.deregister(computeRegistryKey(keyA));
    expect(sim.getLedger().registry.size()).toBe(0n);
  });
});

// refreshValidity tests: verify that the circuit updates the on-chain validTo correctly.
describe('refreshValidity circuit', () => {
  it('updates validTo to the new timestamp', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    const initialValidTo = futureDate(100n);
    sim.register(defaultEntry(initialValidTo));

    const newValidTo = futureDate(MAX_VALIDITY);
    sim.refresh(newValidTo);

    const [, raw] = [...sim.getLedger().registry][0];
    const entry = entryFromContract(raw);
    expect(entry.validTo).toEqual(newValidTo);
  });

  it('refresh does not change the registry key or entry count', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry(futureDate(100n)));

    const [keyBefore] = [...sim.getLedger().registry][0];
    sim.refresh(futureDate(MAX_VALIDITY));
    const [keyAfter] = [...sim.getLedger().registry][0];

    expect(sim.getLedger().registry.size()).toBe(1n);
    expect(keyAfter).toEqual(keyBefore);
  });

  it('refresh does not affect a different entry in the registry', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry(futureDate(100n)));
    sim.useKey(keyB);
    sim.register(defaultEntry(futureDate(200n)));

    // Only refresh keyB's entry
    const newValidTo = futureDate(MAX_VALIDITY);
    sim.refresh(newValidTo);

    // Find each entry by comparing the stored key against the computed registry keys
    const registryKeyA = computeRegistryKey(keyA);
    const registryKeyB = computeRegistryKey(keyB);

    for (const [storedKey, raw] of sim.getLedger().registry) {
      const entry = entryFromContract(raw);
      if (storedKey.every((b: number, i: number) => b === registryKeyA[i])) {
        // keyA's entry should NOT have been updated
        expect(entry.validTo).toEqual(futureDate(100n));
      } else if (storedKey.every((b: number, i: number) => b === registryKeyB[i])) {
        // keyB's entry should have been updated
        expect(entry.validTo).toEqual(newValidTo);
      }
    }
  });

  it('refresh preserves the ip and port of the entry', () => {
    const secretKey = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, secretKey);
    sim.setBlockTime(BASE_TIME);

    const entry = {
      validTo: futureDate(100n),
      ip: { kind: 'ipv6' as const, address: '2001:db8::1' },
      port: 9090,
    };
    sim.register(entry);
    sim.refresh(futureDate(MAX_VALIDITY));

    const [, raw] = [...sim.getLedger().registry][0];
    const updated = entryFromContract(raw);
    expect(updated.port).toBe(9090);
    expect(updated.ip.kind).toBe('ipv6');
  });
});
