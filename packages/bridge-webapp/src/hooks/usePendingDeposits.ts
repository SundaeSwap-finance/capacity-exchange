import { useEffect, useRef } from 'react';
import type { Utxo } from '@capacity-exchange/components';
import type { PendingDeposit } from '../lib/deposits';

const POLL_INTERVAL_MS = 5_000;

interface UsePendingDepositsArgs {
  pendingDeposits: PendingDeposit[];
  utxos: Utxo[];
  onDepositConfirmed: (txHash: string) => void;
  refresh: () => Promise<void>;
}

export function usePendingDeposits({
  pendingDeposits,
  utxos,
  onDepositConfirmed,
  refresh,
}: UsePendingDepositsArgs): void {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll while there are pending deposits
  useEffect(() => {
    if (pendingDeposits.length === 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pendingDeposits.length, refresh]);

  // Remove each pending deposit once its tx appears in the UTxO set
  useEffect(() => {
    for (const pending of pendingDeposits) {
      if (utxos.some((u) => u.txHash === pending.txHash)) {
        onDepositConfirmed(pending.txHash);
      }
    }
  }, [pendingDeposits, utxos, onDepositConfirmed]);
}
