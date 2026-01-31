import React, { useState } from 'react';
import { config } from './config';
import { WalletModeSelector, ExtensionWalletFlow, SeedWalletFlow } from './features/wallet';
import type { WalletMode } from './features/wallet';
import { ConnectionDetailsSection } from './features/endpoint';

const endpoints = [
  { label: 'Indexer', url: config.indexerUrl, healthPath: '', graphql: true },
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

        <div className="space-y-4">
          <ConnectionDetailsSection endpoints={endpoints} />

          {walletMode === null && <WalletModeSelector onSelect={setWalletMode} />}

          {walletMode === 'extension' && (
            <ExtensionWalletFlow networkId={config.networkId} onBack={() => setWalletMode(null)} />
          )}

          {walletMode === 'seed' && <SeedWalletFlow onBack={() => setWalletMode(null)} />}
        </div>
      </div>
    </div>
  );
}

export default App;
