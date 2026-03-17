import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useWallet } from './hooks/useWallet';
import { useAsyncDerived } from './hooks/useAsyncDerived';
import { useUserDeposits } from './hooks/useUserDeposits';
import { useCoinPublicKey } from './hooks/useCoinPublicKey';
import { deriveShieldedAddress } from './lib/midnight';
import { CardanoWalletConnect } from './components/CardanoWalletConnect';
import { MidnightWalletConnect } from './components/MidnightWalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { BridgeCard } from './components/BridgeCard';
import { DepositForm } from './components/DepositForm';
import { DepositList } from './components/DepositList';

function App() {
  const cardanoWallet = useWallet<Blaze<Provider, Wallet>>();
  const midnightWallet = useWallet<ConnectedAPI>();
  const midnightAddress = useAsyncDerived(midnightWallet.data, deriveShieldedAddress) ?? undefined;
  const blaze = cardanoWallet.data ?? undefined;
  const coinPublicKey = useCoinPublicKey(midnightAddress);

  const deposits = useUserDeposits({ coinPublicKey });

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DepositForm blaze={blaze} midnightAddress={midnightAddress} />
            <BridgeCard
              title="Withdraw"
              description="Midnight → Cardano. Burn mADA on the Midnight network and reclaim ADA on Cardano."
            />
          </div>

          <DepositList deposits={deposits} />
        </div>
      </div>
    </>
  );
}

export default App;
