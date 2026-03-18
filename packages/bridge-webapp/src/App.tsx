import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { requireBrowserEnv } from '@capacity-exchange/midnight-core';
import { useWallet } from './hooks/useWallet';
import { useAsyncDerived } from './hooks/useAsyncDerived';
import { useUserDeposits } from './hooks/useUserDeposits';
import { useCoinPublicKey } from './hooks/useCoinPublicKey';
import { deriveShieldedAddress } from './lib/midnight';
import { CardanoWalletConnect } from './components/CardanoWalletConnect';
import { MidnightWalletConnect } from './components/MidnightWalletConnect';
import { NetworkRibbon } from './components/NetworkRibbon';
import { DepositForm } from './components/DepositForm';
import { WithdrawForm } from './components/WithdrawForm';
import { DepositList } from './components/DepositList';

setNetworkId(requireBrowserEnv('VITE_NETWORK_ID'));

function App() {

  const cardanoWallet = useWallet<Blaze<Provider, Wallet>>();
  const midnightWallet = useWallet<ConnectedAPI>();
  const midnightAddress = useAsyncDerived(midnightWallet.data, deriveShieldedAddress).data ?? undefined;
  const blaze = cardanoWallet.data ?? undefined;
  const cardanoAddrs = useAsyncDerived(blaze ?? null, async (b) => {
    const addr = await b.wallet.getChangeAddress();
    return { bech32: addr.toBech32(), hex: addr.toBytes() };
  }).data;
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
            <WithdrawForm
              midnightWallet={midnightWallet.data ?? undefined}
              midnightAddress={midnightAddress}
              cardanoAddress={cardanoAddrs?.bech32}
              cardanoAddressHex={cardanoAddrs?.hex}
            />
          </div>

          <DepositList deposits={deposits} />
        </div>
      </div>
    </>
  );
}

export default App;
