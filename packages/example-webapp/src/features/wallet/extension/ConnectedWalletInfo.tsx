import React from 'react';
import type { WalletCapabilities } from '../types';
import { useWalletInfo } from '../useWalletInfo';
import { LoadingSpinner, ErrorMessage } from '../../../shared/ui';
import { WalletInfoSection } from '../common';

interface ConnectedWalletInfoProps {
  wallet: WalletCapabilities;
}

export function ConnectedWalletInfo({ wallet }: ConnectedWalletInfoProps) {
  const walletInfo = useWalletInfo(wallet);

  if (walletInfo.status === 'loading') {
    return <LoadingSpinner message="Loading wallet info..." />;
  }

  if (walletInfo.status === 'error') {
    return <ErrorMessage message={walletInfo.error} onRetry={walletInfo.retry} />;
  }

  return <WalletInfoSection data={walletInfo.data} />;
}
