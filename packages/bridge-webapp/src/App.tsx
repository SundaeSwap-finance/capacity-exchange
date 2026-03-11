import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useWallet } from './hooks/useWallet';
import { useAsyncDerived } from './hooks/useAsyncDerived';
import { useUserDeposits } from './hooks/useUserDeposits';
import { useCoinPublicKey } from './hooks/useCoinPublicKey';
import { connectCardanoWallet, deriveCardanoDisplay, detectCardanoExtension } from './lib/cip30';
import { deriveMidnightDisplay } from './lib/midnight';
import { truncateAddress } from './lib/format';
import { WalletConnect } from './components/WalletConnect';
import { MidnightWalletConnect } from './components/MidnightWalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { BridgeCard } from './components/BridgeCard';
import { DepositForm } from './components/DepositForm';
import { DepositList } from './components/DepositList';

function App() {
  const cardanoWallet = useWallet<Blaze<Provider, Wallet>>();
  const midnightWallet = useWallet<ConnectedAPI>();
  const cardanoDisplay = useAsyncDerived(cardanoWallet.data, deriveCardanoDisplay);
  const midnightDisplay = useAsyncDerived(midnightWallet.data, deriveMidnightDisplay);
  const blaze = cardanoWallet.data ?? undefined;
  const midnightAddress = midnightDisplay?.shieldedAddress;
  const coinPublicKey = useCoinPublicKey(midnightAddress);

  // TODO(SUNDAE-2362): Return all compatible cardano wallets and let the user choose
  const cardanoDetection = detectCardanoExtension();

  const deposits = useUserDeposits({ coinPublicKey });

  return (
    <>
      <NetworkRibbon />
      <div className="min-h-screen bg-gradient-dark p-8 pt-14">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-dark-50">Bridge — Cardano ↔ Midnight</h1>
            <div className="flex flex-col items-end gap-2">
              {/* TODO(SUNDAE-2362): List all detected Cardano extensions */}
              <WalletConnect
                label="Cardano"
                wallet={cardanoWallet}
                connectOptions={
                  cardanoDetection.ok
                    ? [
                        {
                          label: cardanoDetection.provider.name,
                          icon: cardanoDetection.provider.icon,
                          onSelect: () => cardanoWallet.connect(connectCardanoWallet),
                        },
                      ]
                    : []
                }
                address={cardanoDisplay ? truncateAddress(cardanoDisplay.address) : undefined}
                balance={cardanoDisplay ? `${Number(cardanoDisplay.balanceAda).toFixed(2)} ₳` : undefined}
              />
              <MidnightWalletConnect
                wallet={midnightWallet}
                address={midnightDisplay ? truncateAddress(midnightDisplay.shieldedAddress) : undefined}
                balance={
                  midnightDisplay ? `${(midnightDisplay.nightBalance / 1_000_000n).toLocaleString()} NIGHT` : undefined
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
