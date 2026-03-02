import { useMemo, useSyncExternalStore } from 'react';
import type { Deposit } from '../lib/depositStore';
import { subscribe, getSnapshot, loadDeposits } from '../lib/depositStore';

function recentFirst(a: Deposit, b: Deposit): number {
  if (a.submittedAt != null && b.submittedAt != null) {
    return b.submittedAt - a.submittedAt;
  }
  if (a.submittedAt != null) {
    return -1;
  }
  if (b.submittedAt != null) {
    return 1;
  }
  return 0;
}

/** Reads deposits from localStorage, filtered by coinPublicKey and sorted recent-first. */
export function useDepositStore(coinPublicKey: string | undefined): Deposit[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  return useMemo(() => {
    // snapshot is used as a dependency to trigger recompute on store changes
    void snapshot;
    const all = loadDeposits();
    const userDeposits = coinPublicKey ? all.filter((d) => d.coinPublicKey === coinPublicKey) : [];
    return userDeposits.sort(recentFirst);
  }, [snapshot, coinPublicKey]);
}
