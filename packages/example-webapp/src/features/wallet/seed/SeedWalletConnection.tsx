import React from 'react';
import type { SeedWalletState } from './types';
import { Card, LoadingSpinner } from '../../../shared/ui';
import { SeedInput } from './SeedInput';
import { SeedWalletStatusBadge } from './SeedWalletStatusBadge';
import { SeedWalletActions } from './SeedWalletActions';
import { ConnectedWalletInfo } from '../extension/ConnectedWalletInfo';

interface SeedWalletConnectionProps {
  wallet: SeedWalletState;
}

export function SeedWalletConnection({ wallet }: SeedWalletConnectionProps) {
  const { status, error, connect, disconnect } = wallet;

  return (
    <Card title="Seed Wallet Connection">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SeedWalletStatusBadge status={status} />
          <SeedWalletActions status={status} onDisconnect={disconnect} />
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {status === 'disconnected' && <SeedInput onSubmit={connect} />}

        {status === 'connecting' && (
          <div className="space-y-2">
            <LoadingSpinner message="Deriving keys and syncing wallet..." />
            <p className="text-xs text-dark-500">This may take a moment while we sync with the network.</p>
          </div>
        )}

        {status === 'connected' && wallet.wallet && <ConnectedWalletInfo wallet={wallet.wallet} />}
      </div>
    </Card>
  );
}
