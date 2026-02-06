import React from 'react';
import { useSeedWallet } from './useSeedWallet';
import type { SeedWalletState, SeedWalletStatus } from './types';
import { Card, LoadingSpinner, Message } from '../../../shared/ui';
import { SeedInput } from './SeedInput';
import { SeedWalletStatusBadge } from './SeedWalletStatusBadge';
import { ConnectedWalletInfo } from '../extension/ConnectedWalletInfo';
import type { Config } from '../../../config';

interface SeedWalletActionsProps {
  status: SeedWalletStatus;
  onDisconnect: () => void;
}

function SeedWalletActions({ status, onDisconnect }: SeedWalletActionsProps) {
  if (status !== 'connected') {
    return null;
  }

  return (
    <button
      onClick={onDisconnect}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
    >
      Disconnect
    </button>
  );
}

interface SeedWalletConnectionProps {
  wallet: SeedWalletState;
}

function SeedWalletConnection({ wallet }: SeedWalletConnectionProps) {
  const { status, error, connect, disconnect } = wallet;

  return (
    <Card title="Seed Wallet Connection">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SeedWalletStatusBadge status={status} />
          <SeedWalletActions status={status} onDisconnect={disconnect} />
        </div>

        {error && <Message variant="error">{error}</Message>}

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

interface SeedWalletFlowProps {
  config: Config;
  onBack: () => void;
}

export function SeedWalletFlow({ config, onBack }: SeedWalletFlowProps) {
  const wallet = useSeedWallet(config);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-dark-400 hover:text-white text-sm transition-colors">
        &larr; Back to wallet selection
      </button>

      <SeedWalletConnection wallet={wallet} />
    </div>
  );
}
