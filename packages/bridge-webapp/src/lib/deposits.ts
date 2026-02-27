import type { BridgeDepositUtxo } from '@capacity-exchange/components';

export interface PendingDeposit {
  txHash: string;
  lovelace: bigint;
  coinPublicKey: string;
}

export function filterByCoinPublicKey(deposits: BridgeDepositUtxo[], coinPublicKey: string): BridgeDepositUtxo[] {
  return deposits.filter((u) => u.datum.coinPublicKey === coinPublicKey);
}

export function filterVisiblePending(
  pendingDeposits: PendingDeposit[],
  confirmedDeposits: BridgeDepositUtxo[],
  coinPublicKey?: string
): PendingDeposit[] {
  const confirmedTxHashes = new Set(confirmedDeposits.map((u) => u.txHash));
  return pendingDeposits.filter((d) => {
    const notYetConfirmed = !confirmedTxHashes.has(d.txHash);
    const matchesFilter = !coinPublicKey || d.coinPublicKey === coinPublicKey;
    return notYetConfirmed && matchesFilter;
  });
}
