import type { Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import { lovelaceToAda } from '@capacity-exchange/midnight-core';
import type { WalletState } from '../hooks/useWallet';
import { connectCardanoWallet, detectCardanoExtension } from '../lib/cip30';
import { WalletConnect } from './WalletConnect';

interface CardanoWalletConnectProps {
  wallet: WalletState<Blaze<Provider, Wallet>>;
}

const deriveAddress = async (b: Blaze<Provider, Wallet>) => (await b.wallet.getChangeAddress()).toBech32();

const deriveBalance = async (b: Blaze<Provider, Wallet>) =>
  `${Number(lovelaceToAda((await b.wallet.getBalance()).coin())).toFixed(2)} ₳`;

export function CardanoWalletConnect({ wallet }: CardanoWalletConnectProps) {
  // TODO(SUNDAE-2362): Return all compatible wallets and let the user choose
  const detection = detectCardanoExtension();

  return (
    <WalletConnect
      label="Cardano"
      wallet={wallet}
      connectOptions={
        detection.ok
          ? [
              {
                label: detection.provider.name,
                icon: detection.provider.icon,
                onSelect: () => wallet.connect(connectCardanoWallet),
              },
            ]
          : []
      }
      deriveAddress={deriveAddress}
      deriveBalance={deriveBalance}
    />
  );
}
