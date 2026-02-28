import { useEffect, useRef } from 'react';
import type { BridgeDepositUtxo } from '@capacity-exchange/components';
import type { Deposit } from '../lib/deposits';

const POLL_INTERVAL_MS = 5_000;

interface UseUnconfirmedPollingArgs {
  sessionDeposits: Deposit[];
  utxos: BridgeDepositUtxo[];
  refresh: () => Promise<void>;
}

export function useUnconfirmedPolling({ sessionDeposits, utxos, refresh }: UseUnconfirmedPollingArgs): void {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const confirmedTxHashes = new Set(utxos.map((u) => u.txHash));
  const hasUnconfirmed = sessionDeposits.some((d) => !confirmedTxHashes.has(d.txHash));

  useEffect(() => {
    if (!hasUnconfirmed) {
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
  }, [hasUnconfirmed, refresh]);
}
