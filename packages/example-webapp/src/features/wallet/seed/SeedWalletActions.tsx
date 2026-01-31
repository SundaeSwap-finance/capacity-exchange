import React from 'react';
import type { SeedWalletStatus } from './types';

interface SeedWalletActionsProps {
  status: SeedWalletStatus;
  onDisconnect: () => void;
}

export function SeedWalletActions({ status, onDisconnect }: SeedWalletActionsProps) {
  if (status !== 'connected') {
    return null;
  }

  return (
    <button onClick={onDisconnect} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
      Disconnect
    </button>
  );
}
