import React from 'react';
import type { WalletCapabilities } from '../types';
import type { EndpointConfig } from '../../endpoint';
import { useWalletInfo } from '../useWalletInfo';
import { LoadingSpinner, ErrorMessage } from '../../../shared/ui';
import { WalletInfoSection } from '../common';
import { ConnectionDetailsSection } from '../../endpoint';

interface ConnectedWalletInfoProps {
  wallet: WalletCapabilities;
  endpoints: EndpointConfig[];
}

export function ConnectedWalletInfo({ wallet, endpoints }: ConnectedWalletInfoProps) {
  const walletInfo = useWalletInfo(wallet);

  if (walletInfo.status === 'loading') {
    return <LoadingSpinner message="Loading wallet info..." />;
  }

  if (walletInfo.status === 'error') {
    return <ErrorMessage message={walletInfo.error} onRetry={walletInfo.retry} />;
  }

  return (
    <div className="space-y-3">
      <WalletInfoSection data={walletInfo.data} onRefresh={walletInfo.refresh} />
      <ConnectionDetailsSection endpoints={endpoints} />
    </div>
  );
}
