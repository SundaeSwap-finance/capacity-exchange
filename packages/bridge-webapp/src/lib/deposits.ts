import type { Utxo } from '@capacity-exchange/components';

export type ValidDeposit = Utxo & { datum: { status: 'success' } };

export interface PendingDeposit {
  txHash: string;
  lovelace: string;
  coinPublicKey: string;
}

export function isValidDeposit(utxo: Utxo): utxo is ValidDeposit {
  return utxo.datum?.status === 'success';
}

export function filterByCoinPublicKey(deposits: ValidDeposit[], coinPublicKey: string): ValidDeposit[] {
  return deposits.filter((u) => u.datum.decoded.coinPublicKey === coinPublicKey);
}

export function filterVisiblePending(
  pendingDeposits: PendingDeposit[],
  confirmedDeposits: ValidDeposit[],
  coinPublicKey?: string,
): PendingDeposit[] {
  const confirmedTxHashes = new Set(confirmedDeposits.map((u) => u.txHash));
  return pendingDeposits.filter((d) => {
    const notYetConfirmed = !confirmedTxHashes.has(d.txHash);
    const matchesFilter = !coinPublicKey || d.coinPublicKey === coinPublicKey;
    return notYetConfirmed && matchesFilter;
  });
}

export function totalLovelace(deposits: ValidDeposit[]): bigint {
  return deposits.reduce((sum, u) => sum + BigInt(u.lovelace), 0n);
}