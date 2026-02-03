import { useState, useEffect, useCallback } from 'react';
import type { WalletCapabilities, WalletData, WalletInfoState } from './types';

export function useWalletInfo(wallet: WalletCapabilities): WalletInfoState {
  const [state, setState] = useState<WalletInfoState>({ status: 'loading' });

  const fetchData = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const [dustAddrResult, dustBalResult, shieldedAddrResult, unshieldedAddrResult, unshieldedBalResult] =
        await Promise.all([
          wallet.getDustAddress(),
          wallet.getDustBalance(),
          wallet.getShieldedAddresses(),
          wallet.getUnshieldedAddress(),
          wallet.getUnshieldedBalances(),
        ]);

      const data: WalletData = {
        unshieldedAddress: unshieldedAddrResult.unshieldedAddress,
        shieldedAddress: shieldedAddrResult.shieldedAddress,
        dustAddress: dustAddrResult.dustAddress,
        dustBalance: dustBalResult.balance,
        dustCap: dustBalResult.cap,
        nightBalances: unshieldedBalResult,
      };

      setState({ status: 'ready', data, refresh: fetchData });
    } catch (err) {
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to fetch wallet info',
        retry: fetchData,
      });
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return state;
}
