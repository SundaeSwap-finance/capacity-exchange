import React from 'react';
import { Card } from '../../../shared/ui';
import { useExtensionWallet } from './useExtensionWallet';
import type { ExtensionWalletState } from './useExtensionWallet';
import { ExtensionWalletActions } from './ExtensionWalletActions';
import { ExtensionWalletStatusBadge } from './ExtensionWalletStatusBadge';
import { ConnectedWalletInfo } from './ConnectedWalletInfo';

interface ExtensionWalletConnectionProps {
  wallet: ExtensionWalletState;
}

function ExtensionWalletConnection({ wallet }: ExtensionWalletConnectionProps) {
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

        {status === 'error' && wallet.error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded p-3">
            <p className="text-red-400 text-sm">{wallet.error}</p>
          </div>
        )}

        {status === 'connected' && wallet.wallet && <ConnectedWalletInfo wallet={wallet.wallet} />}
      </div>
    </Card>
  );
}

interface ExtensionWalletFlowProps {
  networkId: string;
  onBack: () => void;
}

export function ExtensionWalletFlow({ networkId, onBack }: ExtensionWalletFlowProps) {
  const wallet = useExtensionWallet(networkId);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-dark-400 hover:text-white text-sm transition-colors">
        &larr; Back to wallet selection
      </button>

      {wallet.status === 'unavailable' ? (
        <Card title="Wallet Connection">
          <div className="bg-red-900/20 border border-red-700/50 rounded p-3">
            <p className="text-red-400 text-sm">
              Lace wallet extension not found. Please install the extension and refresh the page.
            </p>
          </div>
        </Card>
      ) : (
        <ExtensionWalletConnection wallet={wallet} />
      )}
    </div>
  );
}
