import React from 'react';
import { Card } from '../../../shared/ui';
import type { ExtensionWalletState } from './useExtensionWallet';
import { ExtensionWalletConnection } from './ExtensionWalletConnection';

interface ExtensionWalletFlowProps {
  wallet: ExtensionWalletState;
  onBack: () => void;
}

/**
 * Extension wallet flow component.
 *
 * Only renders when the user has selected the browser extension wallet mode.
 */
export function ExtensionWalletFlow({ wallet, onBack }: ExtensionWalletFlowProps) {
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
