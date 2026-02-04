import React, { useState, useMemo } from 'react';
import { NETWORK_CONFIGS, getEndpoints } from './config';
import type { NetworkId } from './config';
import { WalletModeSelector, ExtensionWalletFlow, SeedWalletFlow } from './features/wallet';
import type { WalletMode } from './features/wallet';
import { ConnectionDetailsSection } from './features/endpoint';

function App() {
  const [walletMode, setWalletMode] = useState<WalletMode | null>(null);
  const [networkId, setNetworkId] = useState<NetworkId>('undeployed');

  const currentConfig = NETWORK_CONFIGS[networkId];
  const endpoints = useMemo(() => getEndpoints(currentConfig), [currentConfig]);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Capacity Exchange Demo</h1>
          <p className="mt-2 text-gray-400">Connect your wallet to view wallet info</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ConnectionDetailsSection
              endpoints={endpoints}
              networkId={currentConfig.networkId}
              onNetworkIdChange={(id) => setNetworkId(id as NetworkId)}
            />
          </div>
          <div className="space-y-4">
            {walletMode === null && <WalletModeSelector onSelect={setWalletMode} />}

            {walletMode === 'extension' && (
              <ExtensionWalletFlow networkId={networkId} onBack={() => setWalletMode(null)} />
            )}

            {walletMode === 'seed' && <SeedWalletFlow config={currentConfig} onBack={() => setWalletMode(null)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
