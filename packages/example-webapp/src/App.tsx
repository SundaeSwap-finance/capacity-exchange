import { useState, useMemo } from 'react';
import { config } from './config';
import {
  WalletModeSelector,
  ExtensionWalletFlow,
  SeedWalletFlow,
  useSeedWallet,
  useExtensionWallet,
} from './features/wallet';
import type { WalletMode, WalletCapabilities } from './features/wallet';
import { ConnectionDetailsSection } from './features/endpoint';
import { ContractDeploymentSection, ContractContextProvider } from './features/contract';
import { ContractInteractionsSection, type WalletConnection } from './features/interactions';

const endpoints = [
  { label: 'Indexer', url: config.indexerUrl, healthPath: '', graphql: true },
  { label: 'Proof Server', url: config.proofServerUrl, healthPath: '/health' },
  {
    label: 'Capacity Exchange',
    url: config.capacityExchangeUrl,
    healthPath: '/health',
    readyPath: '/health/ready',
  },
];

function App() {
  const [walletMode, setWalletMode] = useState<WalletMode | null>(null);
  const seedWallet = useSeedWallet();
  const extensionWallet = useExtensionWallet(config.networkId);

  const handleWalletModeBack = () => {
    setWalletMode(null);
    seedWallet.disconnect();
    extensionWallet.disconnect();
  };

  const currentWallet: WalletCapabilities | null = useMemo(() => {
    if (walletMode === 'seed' && seedWallet.status === 'connected') {
      return seedWallet.wallet;
    }
    if (walletMode === 'extension' && extensionWallet.status === 'connected') {
      return extensionWallet.wallet;
    }
    return null;
  }, [walletMode, seedWallet, extensionWallet]);

  const walletConnection: WalletConnection | null = useMemo(() => {
    if (walletMode === 'seed' && seedWallet.status === 'connected' && seedWallet.internals) {
      return {
        type: 'seed' as const,
        walletFacade: seedWallet.internals.walletFacade,
        shieldedSecretKeys: seedWallet.internals.keys.shieldedSecretKeys,
        dustSecretKey: seedWallet.internals.keys.dustSecretKey,
      };
    }
    if (walletMode === 'extension' && extensionWallet.status === 'connected' && extensionWallet.connectedAPI) {
      return {
        type: 'extension' as const,
        connectedAPI: extensionWallet.connectedAPI,
      };
    }
    return null;
  }, [walletMode, seedWallet, extensionWallet]);

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Capacity Exchange Demo</h1>
          <p className="mt-2 text-gray-400">Connect your wallet to view wallet info</p>
        </div>

        <ContractContextProvider>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Server Operations */}
            <div className="space-y-4">
              <ConnectionDetailsSection endpoints={endpoints} />
              <ContractDeploymentSection />
            </div>

            {/* Right Column - Wallet Interactions */}
            <div className="space-y-4">
              {walletMode === null && <WalletModeSelector onSelect={setWalletMode} />}

              {walletMode === 'extension' && (
                <ExtensionWalletFlow wallet={extensionWallet} onBack={handleWalletModeBack} />
              )}

              {walletMode === 'seed' && (
                <SeedWalletFlow wallet={seedWallet} onBack={handleWalletModeBack} />
              )}

              {/* Contract Interactions - shows when wallet is connected */}
              {currentWallet && walletConnection && (
                <ContractInteractionsSection
                  wallet={currentWallet}
                  walletConnection={walletConnection}
                />
              )}
            </div>
          </div>
        </ContractContextProvider>
      </div>
    </div>
  );
}

export default App;
