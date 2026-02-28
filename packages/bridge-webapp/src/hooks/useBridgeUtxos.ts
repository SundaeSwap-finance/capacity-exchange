import { useCallback, useEffect } from 'react';
import { getBridgeDepositUtxos, type BridgeDepositUtxosResult } from '@capacity-exchange/components';
import { createBlockfrostProvider, getBridgeDepositAddress } from '../lib/blockfrost';
import { useAsyncAction } from './useAsyncAction';

export interface UseBridgeUtxosResult {
  result: BridgeDepositUtxosResult | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Fetches confirmed UTXOs at the bridge deposit address on mount. */
export function useBridgeUtxos(): UseBridgeUtxosResult {
  const fetchUtxos = useCallback(() => {
    const bridgeDepositAddress = getBridgeDepositAddress();
    const { provider } = createBlockfrostProvider();
    return getBridgeDepositUtxos(provider, { address: bridgeDepositAddress });
  }, []);

  const { result, error, loading, run: refresh } = useAsyncAction(fetchUtxos);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { result, error, loading, refresh };
}
