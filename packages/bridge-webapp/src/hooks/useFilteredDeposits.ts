import { useMemo } from 'react';
import type { BridgeDepositUtxo } from '@capacity-exchange/components';
import { sumLovelace } from '@capacity-exchange/components';
import { lovelaceToAda, parseCoinPublicKey } from '@capacity-exchange/core';
import { filterByCoinPublicKey, filterVisiblePending, type PendingDeposit } from '../lib/deposits';

interface UseFilteredDepositsArgs {
  utxos: BridgeDepositUtxo[];
  pendingDeposits: PendingDeposit[];
  filterAddress: string;
}

interface UseFilteredDepositsResult {
  filtered: BridgeDepositUtxo[];
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
    const trimmed = filterAddress.trim();

    let coinPublicKey: string | undefined;
    let filterError: string | null = null;

    if (trimmed) {
      const result = parseCoinPublicKey(trimmed);
      if (result.ok) {
        coinPublicKey = result.coinPublicKey;
      } else {
        filterError = result.error;
      }
    }

    const filtered = coinPublicKey ? filterByCoinPublicKey(utxos, coinPublicKey) : utxos;
    const visiblePending = filterVisiblePending(pendingDeposits, filtered, coinPublicKey);
    const totalAdaStr = lovelaceToAda(sumLovelace(filtered));

    return { filtered, visiblePending, totalAdaStr, filterError };
  }, [utxos, pendingDeposits, filterAddress]);
}
