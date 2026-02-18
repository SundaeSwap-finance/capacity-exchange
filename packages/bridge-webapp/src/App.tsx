import { useState, useCallback } from 'react';
import { useCardanoWallet } from './hooks/useCardanoWallet';
import { WalletConnect } from './components/WalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { BridgeCard } from './components/BridgeCard';
import { DepositCard } from './components/DepositCard';
import { DepositsCard, type PendingDeposit } from './components/DepositsCard';

function App() {
  const {
    wallets, connectedWallet, address, balanceAda, blaze,
    connecting, error, refreshWallets, connect, disconnect,
  } = useCardanoWallet();
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [midnightAddress, setMidnightAddress] = useState('');
  const addPending = useCallback((d: PendingDeposit) => setPendingDeposits((prev) => [...prev, d]), []);
  const removePending = useCallback((txHash: string) => setPendingDeposits((prev) => prev.filter((d) => d.txHash !== txHash)), []);

  return (
    <>
      <NetworkRibbon />
      <div className="min-h-screen bg-gradient-dark p-8 pt-14">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-dark-50">
              Bridge — Cardano ↔ Midnight
            </h1>
            <WalletConnect
              wallets={wallets}
              connectedWallet={connectedWallet}
              address={address}
              balanceAda={balanceAda}
              connecting={connecting}
              error={error}
              onOpen={refreshWallets}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DepositCard blaze={blaze} onDepositSuccess={addPending} midnightAddress={midnightAddress} onMidnightAddressChange={setMidnightAddress} />
            <BridgeCard
              title="Withdraw"
              description="Midnight → Cardano. Burn mADA on the Midnight network and reclaim ADA on Cardano."
            />
          </div>

          <DepositsCard pendingDeposits={pendingDeposits} onDepositConfirmed={removePending} filterAddress={midnightAddress} onFilterAddressChange={setMidnightAddress} />
        </div>
      </div>
    </>
  );
}

export default App;
