import React from 'react';
import type { SeedWalletStatus } from './types';

interface SeedWalletStatusBadgeProps {
  status: SeedWalletStatus;
}

const statusStyles: Record<SeedWalletStatus, string> = {
  disconnected: 'bg-dark-800 text-dark-400 border border-dark-700',
  connecting: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
  connected: 'bg-green-900/50 text-green-400 border border-green-700',
};

export function SeedWalletStatusBadge({ status }: SeedWalletStatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-dark-200">Status:</span>
      <span className={`px-2 py-1 rounded text-sm font-medium ${statusStyles[status]}`}>{status}</span>
    </div>
  );
}
