import { describe, it, expect } from 'vitest';
import { RegistrySimulator, randomSecretKey, makeRecipient, ocrt } from './simulator.js';
import { entryFromContract, type IpAddress } from '../src/types.js';

const COLLATERAL = 1000n;
const MAX_VALIDITY = 2_592_000n; // 30 days in seconds

// ensure validTo - maximumValidityInterval never underflows,
// which is not possible in production, but could happen in sims
const BASE_TIME = 10_000_000n;

function futureDate(offsetSeconds: bigint): Date {
  return new Date(Number(BASE_TIME + offsetSeconds) * 1000);
}

function getUnshieldedOutputTotal(effects: ReturnType<RegistrySimulator['getEffects']>): bigint {
  let total = 0n;
  for (const [, amount] of effects.unshieldedOutputs) {
    total += amount;
  }
  return total;
}

function defaultEntry(opts: { validTo?: Date; ip?: IpAddress; port?: number } = {}) {
  return {
    validTo: opts.validTo ?? futureDate(MAX_VALIDITY),
    ip: opts.ip ?? { kind: 'ipv4' as const, address: '192.168.1.1' },
    port: opts.port ?? 8080,
  };
}

// Invariant: the contract's unshielded balance always equals registry.size() * collateralAmount
describe('collateral conservation', () => {
  it('register receives collateral as native token', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    const effects = sim.register(defaultEntry());
    const inputs = [...effects.unshieldedInputs.entries()];
    expect(inputs).toHaveLength(1);
    const [tokenType, amount] = inputs[0];
    expect(tokenType.tag).toBe('unshielded');
    expect(amount).toBe(COLLATERAL);
  });

  it('deregister sends collateral to the specified recipient', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    const registryKey = [...sim.getLedger().registry][0][0];
    const recipient = makeRecipient();
    const effects = sim.deregister(registryKey, recipient);

    expect(getUnshieldedOutputTotal(effects)).toBe(COLLATERAL);

    // Verify the spend is addressed to the correct recipient
    const spends = [...effects.claimedUnshieldedSpends.entries()];
    expect(spends).toHaveLength(1);
    const [[, address], amount] = spends[0];
    expect(amount).toBe(COLLATERAL);
    expect(address).toEqual({
      tag: 'user',
      address: ocrt.decodeUserAddress(recipient.bytes),
    });
  });

  it('balance tracks registration count', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();
    const keyC = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ port: 8080 }));
    sim.useKey(keyB);
    sim.register(defaultEntry({ port: 8081 }));
    sim.useKey(keyC);
    sim.register(defaultEntry({ port: 8082 }));

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

    sim.register(defaultEntry({ port: 8080 }));
    sim.useKey(keyB);
    sim.register(defaultEntry({ port: 8081 }));

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

// Invariant: every (ip, port) socket address in the registry is unique
describe('socket address uniqueness', () => {
  it('two different keys cannot register the same socket address', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    sim.useKey(keyB);

    expect(() => sim.register(defaultEntry())).toThrow(/socket address already registered/);
  });

  it('a deregistered socket address is available again', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry());
    const registryKey = [...sim.getLedger().registry][0][0];
    sim.deregister(registryKey);

    sim.useKey(keyB);
    sim.register(defaultEntry());
    expect(sim.getLedger().registry.size()).toBe(1n);
  });

  it('same ip with different ports both register', () => {
    const keyA = randomSecretKey();
    const keyB = randomSecretKey();

    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, keyA);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ port: 8080 }));
    sim.useKey(keyB);
    sim.register(defaultEntry({ port: 8081 }));

    expect(sim.getLedger().registry.size()).toBe(2n);
  });
});

// Invariant: no entry can have a validTo more than maximumValidityInterval ahead of the block time
describe('validity bounded', () => {
  it('register at exact max boundary succeeds', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    sim.register(defaultEntry({ validTo: futureDate(MAX_VALIDITY) }));
    expect(sim.getLedger().registry.size()).toBe(1n);
  });

  it('register past max boundary fails', () => {
    const key = randomSecretKey();
    const sim = new RegistrySimulator(COLLATERAL, MAX_VALIDITY, key);
    sim.setBlockTime(BASE_TIME);

    expect(() => sim.register(defaultEntry({ validTo: futureDate(MAX_VALIDITY + 1n) }))).toThrow(/validity interval/);
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

    sim.register(defaultEntry({ validTo: futureDate(MAX_VALIDITY - 100n) }));

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
    sim.register(defaultEntry({ validTo }));
    const registryKey = [...sim.getLedger().registry][0][0];

    // Advance past expiry
    sim.setBlockTime(BASE_TIME + 101n);

    sim.useKey(keyB);
    sim.deregister(registryKey);
    expect(sim.getLedger().registry.size()).toBe(0n);
  });
});
