import React from 'react';
import type { SeedWalletState } from './types';
import { SeedWalletConnection } from './SeedWalletConnection';

interface SeedWalletFlowProps {
  wallet: SeedWalletState;
  onBack: () => void;
}

/**
 * Seed wallet flow component.
 *
 * Only renders when the user has selected the seed wallet mode.
 */
export function SeedWalletFlow({ wallet, onBack }: SeedWalletFlowProps) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-dark-400 hover:text-white text-sm transition-colors">
        &larr; Back to wallet selection
      </button>

      <SeedWalletConnection wallet={wallet} />
    </div>
  );
}
