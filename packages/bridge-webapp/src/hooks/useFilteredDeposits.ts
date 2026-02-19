import { useMemo } from 'react';
import type { Utxo } from '@capacity-exchange/components';
import { lovelaceToAda, parseCoinPublicKey } from '@capacity-exchange/core';
import {
  isValidDeposit,
  filterByCoinPublicKey,
  filterVisiblePending,
  totalLovelace,
  type ValidDeposit,
  type PendingDeposit,
} from '../lib/deposits';

interface UseFilteredDepositsArgs {
  utxos: Utxo[];
  pendingDeposits: PendingDeposit[];
  filterAddress: string;
}

interface UseFilteredDepositsResult {
  filtered: ValidDeposit[];
  visiblePending: PendingDeposit[];
  totalAdaStr: string;
  filterError: string | null;
}

export function useFilteredDeposits({
  utxos,
  pendingDeposits,
  filterAddress,
}: UseFilteredDepositsArgs): UseFilteredDepositsResult {
  return useMemo(() => {
    const validDeposits = utxos.filter(isValidDeposit);
    const trimmed = filterAddress.trim();

    let coinPublicKey: string | undefined;
    let filterError: string | null = null;

    if (trimmed) {
      try {
        coinPublicKey = parseCoinPublicKey(trimmed);
      } catch (err) {
        filterError = err instanceof Error ? err.message : 'Invalid Midnight address';
      }
    }

    const filtered = coinPublicKey ? filterByCoinPublicKey(validDeposits, coinPublicKey) : validDeposits;
    const visiblePending = filterVisiblePending(pendingDeposits, filtered, coinPublicKey);
    const totalAdaStr = lovelaceToAda(totalLovelace(filtered));

    return { filtered, visiblePending, totalAdaStr, filterError };
  }, [utxos, pendingDeposits, filterAddress]);
}
