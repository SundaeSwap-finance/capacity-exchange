import { Blaze, WebWallet } from '@blaze-cardano/sdk';
import type { CIP30Interface, Provider, Wallet } from '@blaze-cardano/sdk';
import { lovelaceToAda, type CardanoNetwork } from '@capacity-exchange/core';
import { createBlockfrostProvider } from './blockfrost';

export interface DetectedWallet {
  name: string;
  icon: string;
}

interface Cip30Provider {
  name?: string;
  icon?: string;
  enable?: () => Promise<CIP30Interface>;
}

type WindowWithCardano = Window & { cardano?: Record<string, Cip30Provider> };

function getCardanoProviders(): Record<string, Cip30Provider> | undefined {
  return (window as WindowWithCardano).cardano;
}

export function detectWallets(): DetectedWallet[] {
  const cardano = getCardanoProviders();
  if (!cardano) {
    return [];
  }
  return Object.entries(cardano)
    .filter(
      ([, provider]) =>
        provider && typeof provider === 'object' && typeof provider.enable === 'function' && provider.name
    )
    .map(([key, provider]) => ({
      name: key,
      icon: provider.icon ?? '',
    }));
}

export async function enableWallet(walletName: string): Promise<WebWallet> {
  const walletProvider = getCardanoProviders()?.[walletName];
  if (!walletProvider?.enable) {
    throw new Error(`Wallet "${walletName}" not found`);
  }
  const api = await walletProvider.enable();
  return new WebWallet(api);
}

export async function assertNetworkMatch(webWallet: WebWallet, configuredNetwork: CardanoNetwork): Promise<void> {
  const walletNetworkId = await webWallet.getNetworkId();
  const expectMainnet = configuredNetwork === 'mainnet';
  const walletIsMainnet = walletNetworkId === 1;

  if (expectMainnet && !walletIsMainnet) {
    throw new Error('Wallet is on testnet but app is configured for mainnet. Switch your wallet to mainnet.');
  }
  if (!expectMainnet && walletIsMainnet) {
    throw new Error(
      `Wallet is on mainnet but app is configured for ${configuredNetwork}. Switch your wallet to a testnet.`
    );
  }
}

export interface WalletConnection {
  blaze: Blaze<Provider, Wallet>;
  address: string;
  balanceAda: string;
}

export async function connectWallet(walletName: string): Promise<WalletConnection> {
  const webWallet = await enableWallet(walletName);
  const { provider, network } = createBlockfrostProvider();
  await assertNetworkMatch(webWallet, network);

  const blaze = await Blaze.from(provider, webWallet);
  const address = (await blaze.wallet.getChangeAddress()).toBech32();
  const balance = await blaze.wallet.getBalance();
  const balanceAda = lovelaceToAda(balance.coin());

  return { blaze: blaze as Blaze<Provider, Wallet>, address, balanceAda };
}
