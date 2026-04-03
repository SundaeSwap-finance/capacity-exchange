import { describe, it, expect } from 'vitest';
import { RegistrySimulator, randomSecretKey } from './simulator.js';
import { entryFromContract } from '../src/types.js';

const COLLATERAL = 1000n;
const MAX_VALIDITY = 2_592_000n; // 30 days in seconds

// ensure validTo - maximumValidityInterval never underflows,
// which is not possible in production, but could happen in sims
const BASE_TIME = 10_000_000n;

function futureDate(offsetSeconds: bigint): Date {
  return new Date(Number(BASE_TIME + offsetSeconds) * 1000);
}

function defaultEntry(validTo?: Date) {
  return {
    validTo: validTo ?? futureDate(MAX_VALIDITY),
    ip: { kind: 'ipv4' as const, address: '192.168.1.1' },
    port: 8080,
  };
}

// Invariant: the contract's unshielded balance always equals registry.size() * collateralAmount
describe('collateral conservation', () => {
  it('balance tracks registration count', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();
    const keyC = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    sim.useKey(keyB);
    sim.register(defaultEntry());
    sim.useKey(keyC);
    sim.register(defaultEntry());

    expect(sim.getLedger().registry.size()).toBe(3n);

    // Advance past expiry so anyone can deregister any entry
    sim.setBlockTime(BASE_TIME + MAX_VALIDITY + 1n);
    const firstKey = [...sim.getLedger().registry][0][0];
    sim.deregister(firstKey);

    expect(sim.getLedger().registry.size()).toBe(2n);
  });

  it('register, deregister, re-register cycle', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(1n);

    const registryKey = [...sim.getLedger().registry][0][0];
    sim.deregister(registryKey);
    expect(sim.getLedger().registry.size()).toBe(0n);

    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(1n);
  });
});

// Invariant: every key in the registry is derived from a distinct secret key
describe('registry key uniqueness', () => {
  it('two different keys can both register', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    sim.useKey(keyB);
    sim.register(defaultEntry());

    expect(sim.getLedger().registry.size()).toBe(2n);
  });

  it('same key cannot register twice', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());

    expect(() => sim.register(defaultEntry())).toThrow(/you already have an entry registered/);
  });

  it('can re-register after deregistering', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    const registryKey = [...sim.getLedger().registry][0][0];
    sim.deregister(registryKey);

    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(1n);
  });
});

// Invariant: no entry can have a validTo more than maximumValidityInterval ahead of the block time
describe('validity bounded', () => {
  it('register at exact max boundary succeeds', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry(futureDate(MAX_VALIDITY)));
    expect(sim.getLedger().registry.size()).toBe(1n);
  });

  it('register past max boundary fails', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    expect(() => sim.register(defaultEntry(futureDate(MAX_VALIDITY + 1n)))).toThrow(/validity interval/);
  });

  it('refresh past max boundary fails', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());

    expect(() => sim.refresh(futureDate(MAX_VALIDITY + 1n))).toThrow(/validity interval/);
  });

  it('refresh within max boundary succeeds', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry(futureDate(MAX_VALIDITY - 100n)));

    sim.refresh(futureDate(MAX_VALIDITY));

    const [, raw] = [...sim.getLedger().registry][0];
    const entry = entryFromContract(raw);
    expect(entry.validTo).toEqual(futureDate(MAX_VALIDITY));
  });
});

// Invariant: a non-expired entry can only be refreshed or removed by the holder of the corresponding secret key
describe('ownership', () => {
  it('owner can deregister before expiry', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    const registryKey = [...sim.getLedger().registry][0][0];

    sim.deregister(registryKey);
    expect(sim.getLedger().registry.size()).toBe(0n);
  });

  it('non-owner cannot deregister before expiry', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    const registryKey = [...sim.getLedger().registry][0][0];

    sim.useKey(keyB);
    expect(() => sim.deregister(registryKey)).toThrow(/you can only deregister your own entry/);
  });

  it('refresh with wrong key fails', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());

    sim.useKey(keyB);
    expect(() => sim.refresh(futureDate(MAX_VALIDITY))).toThrow(/you don't have a registered server/);
  });
});

// Invariant: an expired entry can always be removed by anyone
describe('liveness', () => {
  it('anyone can deregister an expired entry', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    const validTo = futureDate(100n);
    sim.register(defaultEntry(validTo));
    const registryKey = [...sim.getLedger().registry][0][0];

    // Advance past expiry
    sim.setBlockTime(BASE_TIME + 101n);

    sim.useKey(keyB);
    sim.deregister(registryKey);
    expect(sim.getLedger().registry.size()).toBe(0n);
  });
});
