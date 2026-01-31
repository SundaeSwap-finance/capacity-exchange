import React from 'react';
import type { ExtensionWalletStatus } from './useExtensionWallet';

interface ExtensionWalletActionsProps {
  status: ExtensionWalletStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ExtensionWalletActions({ status, onConnect, onDisconnect }: ExtensionWalletActionsProps) {
  if (status === 'connected') {
    return (
      <button
        onClick={onDisconnect}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        Disconnect
      </button>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={status === 'connecting'}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
