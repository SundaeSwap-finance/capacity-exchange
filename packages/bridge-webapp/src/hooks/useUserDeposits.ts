import { sumLovelace } from '@capacity-exchange/components';
import { lovelaceToAda } from '@capacity-exchange/core';
import type { Deposit } from '../lib/deposits';
import { useBridgeUtxos } from './useBridgeUtxos';
import { useUnconfirmedPolling } from './usePendingDeposits';

export interface UseUserDepositsResult {
  deposits: Deposit[];
  totalAdaStr: string;
  fetchError: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

interface UseUserDepositsArgs {
  sessionDeposits: Deposit[];
  coinPublicKey: string | undefined;
}

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

export function useUserDeposits({
  sessionDeposits,
  coinPublicKey,
}: UseUserDepositsArgs): UseUserDepositsResult | undefined {
  const { result, error: fetchError, loading, refresh } = useBridgeUtxos();

  const allUtxos = result?.utxos ?? [];

  useUnconfirmedPolling({
    sessionDeposits,
    utxos: allUtxos,
    refresh,
  });

  if (!coinPublicKey) {
    return undefined;
  }

  const userUtxos = allUtxos.filter((u) => u.datum.coinPublicKey === coinPublicKey);
  const sessionByTxHash = new Map(sessionDeposits.map((d) => [d.txHash, d]));
  const confirmedTxHashes = new Set(userUtxos.map((u) => u.txHash));

  const confirmed: Deposit[] = userUtxos.map((u) => {
    const session = sessionByTxHash.get(u.txHash);
    return {
      txHash: u.txHash,
      index: u.index,
      lovelace: u.lovelace,
      coinPublicKey: u.datum.coinPublicKey,
      submittedAt: session?.submittedAt,
      status: 'confirmed' as const,
    };
  });

  const unconfirmed: Deposit[] = sessionDeposits.filter(
    (d) => d.coinPublicKey === coinPublicKey && !confirmedTxHashes.has(d.txHash)
  );

  const deposits = [...unconfirmed, ...confirmed].sort(recentFirst);
  const totalAdaStr = lovelaceToAda(sumLovelace(confirmed));

  return { deposits, totalAdaStr, fetchError, loading, refresh };
}
