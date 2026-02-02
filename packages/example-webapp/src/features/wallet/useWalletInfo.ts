import { useState, useEffect, useCallback, useRef } from 'react';
import type { WalletCapabilities, WalletData, WalletInfoState } from './types';

const AUTO_REFRESH_INTERVAL = 5000; // 5 seconds

export function useWalletInfo(wallet: WalletCapabilities): WalletInfoState {
  const [state, setState] = useState<WalletInfoState>({ status: 'loading' });
  const isFirstLoad = useRef(true);

  const fetchData = useCallback(async () => {
    // Only show loading state on first load
    if (isFirstLoad.current) {
      setState({ status: 'loading' });
    }

    try {
      const [dustAddrResult, dustBalResult, shieldedAddrResult, unshieldedAddrResult, unshieldedBalResult, shieldedBalResult] =
        await Promise.all([
          wallet.getDustAddress(),
          wallet.getDustBalance(),
          wallet.getShieldedAddresses(),
          wallet.getUnshieldedAddress(),
          wallet.getUnshieldedBalances(),
          wallet.getShieldedBalances(),
        ]);

      const data: WalletData = {
        unshieldedAddress: unshieldedAddrResult.unshieldedAddress,
        shieldedAddress: shieldedAddrResult.shieldedAddress,
        dustAddress: dustAddrResult.dustAddress,
        dustBalance: dustBalResult.balance,
        dustCap: dustBalResult.cap,
        nightBalances: unshieldedBalResult,
        shieldedBalances: shieldedBalResult,
      };

      isFirstLoad.current = false;
      setState({ status: 'ready', data, refresh: fetchData });
    } catch (err) {
      // Don't overwrite good state with error on background refresh
      if (isFirstLoad.current) {
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to fetch wallet info',
          retry: fetchData,
        });
      }
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();

    // Set up auto-refresh interval
    const intervalId = setInterval(fetchData, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  return state;
}
