import { useCallback, useMemo } from 'react';
import { isTransactionConfirmed } from '@capacity-exchange/core';
import type { Deposit } from '../lib/depositStore';
import { loadDeposits, markConfirmed } from '../lib/depositStore';
import { getBlockfrostConfig } from '../lib/blockfrost';
import { usePolling } from './usePolling';

const POLL_INTERVAL_MS = 5_000;

async function checkUnconfirmedDeposits(): Promise<void> {
  const all = loadDeposits();
  const unconfirmed = all.filter((d) => d.status === 'unconfirmed');
  if (unconfirmed.length === 0) {
    return;
  }

  const config = getBlockfrostConfig();
  await Promise.all(
    unconfirmed.map(async (d) => {
      try {
        const confirmed = await isTransactionConfirmed(d.txHash, config);
        if (confirmed) {
          markConfirmed(d.txHash);
        }
      } catch {
        // Ignore individual tx check failures
      }
    })
  );
}

/** Polls Blockfrost for unconfirmed deposits and marks them confirmed in localStorage. */
export function useConfirmationPolling(deposits: Deposit[]) {
  const hasUnconfirmed = useMemo(() => deposits.some((d) => d.status === 'unconfirmed'), [deposits]);
  const action = useCallback(() => checkUnconfirmedDeposits(), []);

  return usePolling({
    action,
    enabled: hasUnconfirmed,
    intervalMs: POLL_INTERVAL_MS,
  });
}
