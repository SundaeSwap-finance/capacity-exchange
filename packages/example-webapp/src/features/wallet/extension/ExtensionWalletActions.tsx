import React from 'react';
import { Button } from '../../../shared/ui/Button';
import type { ExtensionWalletStatus } from './useExtensionWallet';

interface ExtensionWalletActionsProps {
  status: ExtensionWalletStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ExtensionWalletActions({ status, onConnect, onDisconnect }: ExtensionWalletActionsProps) {
  if (status === 'connected') {
    return (
      <Button variant="red" onClick={onDisconnect}>
        Disconnect
      </Button>
    );
  }

  return (
    <Button variant="blue" onClick={onConnect} disabled={status === 'connecting'}>
      {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
