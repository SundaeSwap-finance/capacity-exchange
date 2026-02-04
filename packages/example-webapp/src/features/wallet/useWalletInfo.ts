import { useState, useEffect, useCallback } from 'react';
import type { BalanceData, WalletCapabilities, WalletInfoState } from './types';

interface Addresses {
  unshieldedAddress: string;
  shieldedAddress: string;
  dustAddress: string;
}

export function useWalletInfo(wallet: WalletCapabilities): WalletInfoState {
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setError(null);

    try {
      const [dustAddrResult, shieldedAddrResult, unshieldedAddrResult] = await Promise.all([
        wallet.getDustAddress(),
        wallet.getShieldedAddresses(),
        wallet.getUnshieldedAddress(),
      ]);

      setAddresses({
        unshieldedAddress: unshieldedAddrResult.unshieldedAddress,
        shieldedAddress: shieldedAddrResult.shieldedAddress,
        dustAddress: dustAddrResult.dustAddress,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet info');
    }
  }, [wallet]);

  // Fetch addresses on mount
  useEffect(() => {
    retry();
  }, [retry]);

  // Subscribe to balance updates
  useEffect(() => {
    return wallet.subscribeToBalances((update) => {
      if (update.status === 'success') {
        setBalances(update.data);
        setError(null);
      } else {
        setError(update.error);
      }
    });
  }, [wallet]);

  if (error) {
    return { status: 'error', error, retry };
  }

  if (addresses && balances) {
    return {
      status: 'ready',
      data: { ...addresses, ...balances },
    };
  }

  return { status: 'loading' };
}
