import { useCallback, useEffect } from 'react';
import { getUtxos, type UtxosResult } from '@capacity-exchange/components';
import { createBlockfrostProvider, getDepositAddress } from '../lib/blockfrost';
import { useAsyncAction } from './useAsyncAction';

interface UseDepositsResult {
  result: UtxosResult | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDeposits(): UseDepositsResult {
  const fetchUtxos = useCallback(() => {
    const address = getDepositAddress();
    const { provider } = createBlockfrostProvider();
    return getUtxos(provider, { address });
  }, []);

  const { result, error, loading, run } = useAsyncAction(fetchUtxos);

  useEffect(() => {
    run();
  }, [run]);

  return { result, error, loading, refresh: run };
}
