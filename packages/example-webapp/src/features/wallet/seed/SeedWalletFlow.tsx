import React from 'react';
import type { SeedWalletState, SeedWalletStatus } from './types';
import { Button, Card, LoadingSpinner, Message } from '../../../shared/ui';
import { SeedInput } from './SeedInput';
import { SeedWalletStatusBadge } from './SeedWalletStatusBadge';
import { ConnectedWalletInfo } from '../extension/ConnectedWalletInfo';
import type { NetworkConfig } from '../../../config';

interface SeedWalletActionsProps {
  status: SeedWalletStatus;
  onDisconnect: () => void;
}

function SeedWalletActions({ status, onDisconnect }: SeedWalletActionsProps) {
  if (status !== 'connected') {
    return null;
  }

  return (
    <Button variant="red" onClick={onDisconnect}>
      Disconnect
    </Button>
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
  config: NetworkConfig;
  wallet: SeedWalletState;
  onBack: () => void;
}

export function SeedWalletFlow({ wallet, onBack }: SeedWalletFlowProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        &larr; Back to wallet selection
      </Button>

      <SeedWalletConnection wallet={wallet} />
    </div>
  );
}
