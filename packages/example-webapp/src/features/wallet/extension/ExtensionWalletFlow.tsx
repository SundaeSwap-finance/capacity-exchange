import React from 'react';
import { Button, Card, Message } from '../../../shared/ui';
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

        {status === 'error' && wallet.error && <Message variant="error">{wallet.error}</Message>}

        {status === 'connected' && wallet.wallet && <ConnectedWalletInfo wallet={wallet.wallet} />}
      </div>
    </Card>
  );
}

interface ExtensionWalletFlowProps {
  wallet: ExtensionWalletState;
  onBack: () => void;
}

export function ExtensionWalletFlow({ wallet, onBack }: ExtensionWalletFlowProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        &larr; Back to wallet selection
      </Button>

      {wallet.status === 'unavailable' ? (
        <Card title="Wallet Connection">
          <Message variant="error">
            Lace wallet extension not found. Please install the extension and refresh the page.
          </Message>
        </Card>
      ) : (
        <ExtensionWalletConnection wallet={wallet} />
      )}
    </div>
  );
}
