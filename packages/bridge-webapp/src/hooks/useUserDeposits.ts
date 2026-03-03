import { useDepositStore } from './useDepositStore';
import { useConfirmationPolling } from './useConfirmationPolling';
import type { Deposit } from '../lib/depositStore';

export interface UseUserDepositsResult {
  deposits: Deposit[];
  loading: boolean;
}

interface UseUserDepositsArgs {
  coinPublicKey: string | undefined;
}

export function useUserDeposits({ coinPublicKey }: UseUserDepositsArgs): UseUserDepositsResult | undefined {
  const deposits = useDepositStore(coinPublicKey);
  const { loading } = useConfirmationPolling(deposits);

  if (!coinPublicKey) {
    return undefined;
  }

  return { deposits, loading };
}
