import React from 'react';
import type { ExtensionWalletStatus } from './useExtensionWallet';

interface ExtensionWalletStatusBadgeProps {
  status: ExtensionWalletStatus;
}

const statusStyles: Record<ExtensionWalletStatus, string> = {
  unavailable: 'bg-red-900/50 text-red-400 border border-red-700',
  disconnected: 'border',
  connecting: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
  connected: 'bg-green-900/50 text-green-400 border border-green-700',
  error: 'bg-red-900/50 text-red-400 border border-red-700',
};

export function ExtensionWalletStatusBadge({ status }: ExtensionWalletStatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">Status:</span>
      <span className={`px-2 py-1 rounded-sm text-sm font-medium ${statusStyles[status]}`}>{status}</span>
    </div>
  );
}
