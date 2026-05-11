import type { ServerAddress } from '../src/types.js';

export const COLLATERAL = 1000n;
export const MAX_VALIDITY = 2_592_000n; // 30 days in seconds

// ensure expiry - maximumRegistrationPeriod never underflows,
// which is not possible in production, but could happen in sims
export const BASE_TIME = 10_000_000n;

export function futureDate(offsetSeconds: bigint): Date {
  return new Date(Number(BASE_TIME + offsetSeconds) * 1000);
}

export function defaultEntry(opts: { expiry?: Date; address?: ServerAddress } = {}) {
  return {
    expiry: opts.expiry ?? futureDate(MAX_VALIDITY),
    address: opts.address ?? { kind: 'srv' as const, address: '_ces._tcp.example.com' },
  };
}
