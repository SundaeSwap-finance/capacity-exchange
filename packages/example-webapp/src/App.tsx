import React, { useState } from 'react';
import { config } from './config';
import { WalletModeSelector, ExtensionWalletFlow } from './features/wallet';
import type { WalletMode } from './features/wallet';
import { Card } from './shared/ui';

const endpoints = [
  { label: 'Indexer', url: config.indexerUrl, healthPath: '/v1/health' },
  { label: 'Proof Server', url: config.proofServerUrl, healthPath: '/health' },
  { label: 'Capacity Exchange', url: config.capacityExchangeUrl, healthPath: '/health', readyPath: '/health/ready' },
];

function App() {
  const [walletMode, setWalletMode] = useState<WalletMode | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Capacity Exchange Demo</h1>
          <p className="mt-2 text-gray-400">Connect your wallet to view wallet info</p>
        </div>

        {walletMode === null && <WalletModeSelector onSelect={setWalletMode} />}

        {walletMode === 'extension' && (
          <ExtensionWalletFlow networkId={config.networkId} endpoints={endpoints} onBack={() => setWalletMode(null)} />
        )}

        {walletMode === 'seed' && (
          <div className="space-y-4">
            <button
              onClick={() => setWalletMode(null)}
              className="text-dark-400 hover:text-white text-sm transition-colors"
            >
              &larr; Back to wallet selection
            </button>
            <Card title="Secret Key Wallet">
              <p className="text-dark-400 text-sm">Not yet implemented</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
