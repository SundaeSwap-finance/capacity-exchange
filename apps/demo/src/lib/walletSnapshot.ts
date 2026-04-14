import type { ChainSnapshot } from '@sundaeswap/capacity-exchange-core';

let cached: Promise<ChainSnapshot | null> | null = null;

/** Fetches chain-state snapshots from the webapp's public assets. */
export function loadSnapshots(networkId: string): Promise<ChainSnapshot | null> {
  if (!cached) {
    cached = Promise.all([
      fetch(`/wallet-snapshots/${networkId}-shielded.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/wallet-snapshots/${networkId}-dust.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/wallet-snapshots/${networkId}-unshielded.json`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([shielded, dust, unshielded]) => {
        if (!shielded || !dust || !unshielded) {
          return null;
        }
        return { shielded, dust, unshielded } as ChainSnapshot;
      })
      .catch((err) => {
        console.warn('[WalletSnapshot] Failed to load:', err);
        cached = null;
        return null;
      });
  }
  return cached;
}
