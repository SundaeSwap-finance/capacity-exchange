import { useWallet } from './hooks/useWallet';
import { useAsyncDerived } from './hooks/useAsyncDerived';
import { useUserDeposits } from './hooks/useUserDeposits';
import { useCoinPublicKey } from './hooks/useCoinPublicKey';
import { connectCardanoWallet, deriveCardanoDisplay } from './lib/cip30';
import { connectMidnightWallet, deriveMidnightDisplay } from './lib/midnight';
import { truncateAddress } from './lib/format';
import { WalletConnect } from './components/WalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { BridgeCard } from './components/BridgeCard';
import { DepositForm } from './components/DepositForm';
import { DepositList } from './components/DepositList';

function App() {
  const cardanoWallet = useWallet(connectCardanoWallet);
  const midnightWallet = useWallet(connectMidnightWallet);
  const cardanoDisplay = useAsyncDerived(cardanoWallet.data, deriveCardanoDisplay);
  const midnightDisplay = useAsyncDerived(midnightWallet.data, deriveMidnightDisplay);
  const blaze = cardanoWallet.data ?? undefined;
  const midnightAddress = midnightDisplay?.shieldedAddress;
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
              <WalletConnect
                label="Cardano"
                wallet={cardanoWallet}
                renderConnected={() =>
                  cardanoDisplay && (
                    <>
                      <span className="text-muted-xs font-mono">{truncateAddress(cardanoDisplay.address)}</span>
                      <span className="separator">|</span>
                      <span className="text-dark-200 text-xs font-medium">
                        {Number(cardanoDisplay.balanceAda).toFixed(2)} ₳
                      </span>
                    </>
                  )
                }
              />
              <WalletConnect
                label="Midnight"
                wallet={midnightWallet}
                renderConnected={() =>
                  midnightDisplay && (
                    <>
                      <span className="text-muted-xs font-mono">
                        {truncateAddress(midnightDisplay.shieldedAddress)}
                      </span>
                      <span className="separator">|</span>
                      <span className="text-dark-200 text-xs font-medium">
                        {(midnightDisplay.nightBalance / 1_000_000n).toLocaleString()} NIGHT
                      </span>
                    </>
                  )
                }
              />
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
