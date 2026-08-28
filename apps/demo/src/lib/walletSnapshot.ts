import type { ChainSnapshot } from '@sundaeswap/capacity-exchange-core';

let cached: Promise<ChainSnapshot | null> | null = null;

/**
 * Fetches chain-state snapshots from the webapp's public assets.
 *
 * DUST is deliberately absent: demo wallets are created with dustMode 'none' (the capacity
 * exchange pays their fees), so there is no DUST state to pre-sync.
 */
export function loadSnapshots(networkId: string): Promise<ChainSnapshot | null> {
  if (!cached) {
    const init: RequestInit = { cache: 'no-cache' };
    cached = Promise.all([
      fetch(`/wallet-snapshots/${networkId}-shielded.json`, init).then((r) => (r.ok ? r.json() : null)),
      fetch(`/wallet-snapshots/${networkId}-unshielded.json`, init).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([shielded, unshielded]) => {
        if (!shielded || !unshielded) {
          return null;
        }
        return { shielded, unshielded } as ChainSnapshot;
      })
      .catch((err) => {
        console.warn('[WalletSnapshot] Failed to load:', err);
        cached = null;
        return null;
      });
  }
  return cached;
}
