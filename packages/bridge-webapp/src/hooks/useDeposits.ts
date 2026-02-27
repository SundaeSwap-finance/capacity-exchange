import { useCallback, useEffect } from 'react';
import { getBridgeDepositUtxos, type BridgeDepositUtxosResult } from '@capacity-exchange/components';
import { createBlockfrostProvider, getDepositAddress } from '../lib/blockfrost';
import { useAsyncAction } from './useAsyncAction';

interface UseDepositsResult {
  result: BridgeDepositUtxosResult | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDeposits(): UseDepositsResult {
  const fetchUtxos = useCallback(() => {
    const address = getDepositAddress();
    const { provider } = createBlockfrostProvider();
    return getBridgeDepositUtxos(provider, { address });
  }, []);

  const { result, error, loading, run } = useAsyncAction(fetchUtxos);

  useEffect(() => {
    run();
  }, [run]);

  return { result, error, loading, refresh: run };
}
