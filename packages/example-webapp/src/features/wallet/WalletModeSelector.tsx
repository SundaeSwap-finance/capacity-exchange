import React from 'react';
import { Card } from '../../shared/ui';

export type WalletMode = 'extension' | 'seed';

interface WalletModeSelectorProps {
  onSelect: (mode: WalletMode) => void;
}

export function WalletModeSelector({ onSelect }: WalletModeSelectorProps) {
  return (
    <Card title="Select Wallet Type">
      <div className="space-y-3">
        <button
          onClick={() => onSelect('extension')}
          className="w-full p-4 text-left bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors"
        >
          <div className="font-medium text-white">Browser Extension</div>
          <div className="text-sm text-dark-400 mt-1">Connect using Lace wallet extension</div>
        </button>
        <button
          onClick={() => onSelect('seed')}
          className="w-full p-4 text-left bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors"
        >
          <div className="font-medium text-white">Secret Key</div>
          <div className="text-sm text-dark-400 mt-1">Provide a secret key directly</div>
        </button>
      </div>
    </Card>
  );
}
