import { describe, it, expect } from 'vitest';
import { assertFundsThisSwap, assertDustCoversFee } from '../src/lib/validateCapacity.js';
import type { CapacityFragment } from '../src/lib/capacity.js';
import type { CouplingRequest } from '../src/lib/couplingParams.js';

const H_PRIME = new Uint8Array(32).fill(2);
const NONCE = new Uint8Array(32).fill(3);
const OTHER = new Uint8Array(32).fill(9);

const request = (over: Partial<CouplingRequest> = {}): CouplingRequest =>
  ({ h: new Uint8Array(32).fill(1), hPrime: H_PRIME, nonce: NONCE, vFeeSpecks: 100n, ...over }) as CouplingRequest;

const funded = (priced: Record<string, unknown>): CapacityFragment =>
  ({ proven: {} as never, priced: { hPrime: H_PRIME, nonce: NONCE, vFeeSpecks: 100n, ...priced } }) as CapacityFragment;

describe('the LP fragment must fund THIS swap', () => {
  it('accepts a fragment matching the request', () => {
    expect(() => assertFundsThisSwap(funded({}), request())).not.toThrow();
  });

  // A fragment funded for a different swap merges and binds fine. Without this check the
  // mismatch surfaces only when the node rejects it, after the escrow committed real funds.
  it('rejects a fragment whose hPrime belongs to another swap', () => {
    expect(() => assertFundsThisSwap(funded({ hPrime: OTHER }), request())).toThrow(/hPrime commitment mismatch/);
  });

  it('rejects a fragment whose nonce belongs to another swap', () => {
    expect(() => assertFundsThisSwap(funded({ nonce: OTHER }), request())).toThrow(/nonce commitment mismatch/);
  });

  it('rejects a fragment funding fewer specks than requested', () => {
    expect(() => assertFundsThisSwap(funded({ vFeeSpecks: 99n }), request())).toThrow(/funds 99 specks/);
  });
});

describe('the funded dust must cover the bound tx', () => {
  const params = {} as never;

  it('accepts a fee equal to the dust funded', () => {
    expect(() => assertDustCoversFee({ fees: () => 100n }, 100n, params)).not.toThrow();
  });

  // The dust is sized from the user tx alone, but the submitted tx also carries the reveal
  // and absorb calls and an offer, so its real fee is strictly greater.
  it('rejects a fee exceeding the dust funded', () => {
    expect(() => assertDustCoversFee({ fees: () => 101n }, 100n, params)).toThrow(/101 specks exceeds the 100/);
  });
});

describe('a mismatch must be distinguishable from any other failure', () => {
  // checkBinding used to report the property holding on ANY throw, so a proof-server
  // outage or a dust-selection failure read as "binding rejected the wrong commitment".
  // The message has to name the mismatch for a caller to tell the cases apart.
  it('names the mismatched field, so an unrelated failure cannot masquerade as one', () => {
    const unrelated = new Error('connect ECONNREFUSED 127.0.0.1:6300');
    expect(/commitment mismatch/.test(unrelated.message)).toBe(false);

    let caught = '';
    try {
      assertFundsThisSwap(funded({ hPrime: OTHER }), request());
    } catch (e) {
      caught = (e as Error).message;
    }
    expect(/commitment mismatch/.test(caught)).toBe(true);
  });
});
