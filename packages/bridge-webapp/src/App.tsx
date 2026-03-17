import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { requireBrowserEnv } from '@capacity-exchange/midnight-core';
import { useWallet } from './hooks/useWallet';
import { CardanoWalletConnect } from './components/CardanoWalletConnect';
import { MidnightWalletConnect } from './components/MidnightWalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { BridgeOps } from './components/BridgeOps';

setNetworkId(requireBrowserEnv('VITE_NETWORK_ID'));

function App() {
  const cardanoWallet = useWallet<Blaze<Provider, Wallet>>();
  const midnightWallet = useWallet<ConnectedAPI>();

  return (
    <>
      <NetworkRibbon />
      <div className="min-h-screen bg-gradient-dark p-8 pt-14">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-dark-50">Bridge — Cardano ↔ Midnight</h1>
            <div className="flex flex-col items-end gap-2">
              <CardanoWalletConnect wallet={cardanoWallet} />
              <MidnightWalletConnect wallet={midnightWallet} />
            </div>
          </div>

          <BridgeOps
            blaze={cardanoWallet.data ?? undefined}
            midnightWallet={midnightWallet.data ?? undefined}
          />
        </div>
      </div>
    </>
  );
}

export default App;
