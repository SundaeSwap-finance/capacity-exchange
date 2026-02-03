import React from 'react';
import type { ExtensionWalletState } from './useExtensionWallet';
import type { EndpointConfig } from '../../endpoint';
import { Card } from '../../../shared/ui';
import { ExtensionWalletActions } from './ExtensionWalletActions';
import { ExtensionWalletStatusBadge } from './ExtensionWalletStatusBadge';
import { ConnectedWalletInfo } from './ConnectedWalletInfo';

export interface ExtensionWalletConnectionProps {
  wallet: ExtensionWalletState;
  endpoints: EndpointConfig[];
}

export function ExtensionWalletConnection({ wallet, endpoints }: ExtensionWalletConnectionProps) {
  const { status, connect, disconnect } = wallet;

  return (
    <Card title="Wallet Connection">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ExtensionWalletStatusBadge status={status} />
          <ExtensionWalletActions status={status} onConnect={connect} onDisconnect={disconnect} />
        </div>

        {status === 'connecting' && (
          <p className="text-sm text-dark-400">Please unlock your Lace wallet and approve the connection...</p>
        )}

        {status === 'connected' && wallet.wallet && (
          <ConnectedWalletInfo wallet={wallet.wallet} endpoints={endpoints} />
        )}
      </div>
    </Card>
  );
}
