import React, { useState, useMemo } from 'react';
import { NETWORK_CONFIGS, getEndpoints } from './config';
import type { NetworkId } from './config';
import {
  WalletModeSelector,
  ExtensionWalletFlow,
  SeedWalletFlow,
  useSeedWallet,
  useExtensionWallet,
  useActiveWallet,
} from './features/wallet';
import type { WalletMode } from './features/wallet';
import { ConnectionDetailsSection } from './features/endpoint';
import { ContractConfigSection, ContractContextProvider } from './features/contract';
import { CounterIncrementInteraction } from './features/interactions';

function App() {
  const [walletMode, setWalletMode] = useState<WalletMode | null>(null);
  const [networkId, setNetworkId] = useState<NetworkId>('undeployed');

  const currentConfig = NETWORK_CONFIGS[networkId];
  const endpoints = useMemo(() => getEndpoints(currentConfig), [currentConfig]);

  const seedWallet = useSeedWallet(currentConfig);
  const extensionWallet = useExtensionWallet(networkId);
  const { wallet, walletConnection } = useActiveWallet(walletMode, seedWallet, extensionWallet);

  const handleWalletModeBack = () => {
    setWalletMode(null);
    seedWallet.disconnect();
    extensionWallet.disconnect();
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Capacity Exchange Demo</h1>
          <p className="mt-2 text-gray-400">Connect your wallet to view wallet info</p>
        </div>

        <ContractContextProvider>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ConnectionDetailsSection
                endpoints={endpoints}
                networkId={currentConfig.networkId}
                onNetworkIdChange={(id) => setNetworkId(id as NetworkId)}
              />
              <ContractConfigSection networkId={networkId} wallet={wallet} />
            </div>

            <div className="space-y-4">
              {walletMode === null && <WalletModeSelector onSelect={setWalletMode} />}

              {walletMode === 'extension' && (
                <ExtensionWalletFlow wallet={extensionWallet} onBack={handleWalletModeBack} />
              )}

              {walletMode === 'seed' && (
                <SeedWalletFlow config={currentConfig} wallet={seedWallet} onBack={handleWalletModeBack} />
              )}

              <CounterIncrementInteraction wallet={wallet} walletConnection={walletConnection} />
            </div>
          </div>
        </ContractContextProvider>
      </div>
    </div>
  );
}

export default App;
