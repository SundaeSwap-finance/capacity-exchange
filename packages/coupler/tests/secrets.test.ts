import { describe, it, expect } from 'vitest';
import { persistentHash, Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';
import { inMemoryPrivateStateProvider } from '@sundaeswap/capacity-exchange-core';
import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { generateSwapSecrets, provisionSPrime } from '../src/lib/secrets.js';
import { createPrivateState } from '../src/lib/witnesses.js';

describe('generateSwapSecrets', () => {
  it('returns 32-byte secrets and commitments', () => {
    const sec = generateSwapSecrets();
    expect(sec.s).toHaveLength(32);
    expect(sec.sPrime).toHaveLength(32);
    expect(sec.h).toHaveLength(32);
    expect(sec.hPrime).toHaveLength(32);
  });

  it('binds h and hPrime to s and sPrime via persistentHash', () => {
    const sec = generateSwapSecrets();
    expect(sec.h).toEqual(persistentHash(Bytes32Descriptor, sec.s));
    expect(sec.hPrime).toEqual(persistentHash(Bytes32Descriptor, sec.sPrime));
  });

  it('draws fresh secrets each call', () => {
    const a = generateSwapSecrets();
    const b = generateSwapSecrets();
    expect(a.s).not.toEqual(b.s);
    expect(a.sPrime).not.toEqual(b.sPrime);
  });
});

describe('provisionSPrime', () => {
  const makeCtx = () => {
    const privateStateProvider = inMemoryPrivateStateProvider();
    return { privateStateProvider, ctx: { privateStateProvider } as unknown as AppContext };
  };

  it('round-trips s-prime through the private-state store', async () => {
    const { privateStateProvider, ctx } = makeCtx();
    const { sPrime } = generateSwapSecrets();
    const id = await provisionSPrime(ctx, sPrime);
    expect(await privateStateProvider.get(id)).toEqual(createPrivateState(sPrime));
  });

  it('uses a distinct id per call', async () => {
    const { ctx } = makeCtx();
    const { sPrime } = generateSwapSecrets();
    const id1 = await provisionSPrime(ctx, sPrime);
    const id2 = await provisionSPrime(ctx, sPrime);
    expect(id1).not.toEqual(id2);
  });
});
