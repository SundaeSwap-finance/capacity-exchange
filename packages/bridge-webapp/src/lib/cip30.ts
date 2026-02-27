import { Blaze, WebWallet } from '@blaze-cardano/sdk';
import type { CIP30Interface, Provider, Wallet } from '@blaze-cardano/sdk';
import { lovelaceToAda, type CardanoNetwork } from '@capacity-exchange/core';

export interface CardanoDisplayInfo {
  address: string;
  balanceAda: string;
}

export async function deriveCardanoDisplay(blaze: Blaze<Provider, Wallet>): Promise<CardanoDisplayInfo> {
  return {
    address: (await blaze.wallet.getChangeAddress()).toBech32(),
    balanceAda: lovelaceToAda((await blaze.wallet.getBalance()).coin()),
  };
}
import { createBlockfrostProvider } from './blockfrost';

interface Cip30Provider {
  name?: string;
  icon?: string;
  enable?: () => Promise<CIP30Interface>;
}

export type DetectCardanoWalletResult =
  | { ok: true; name: string; provider: Cip30Provider }
  | { ok: false; reason: 'no-cardano' }
  | { ok: false; reason: 'no-compatible-wallet' };

// TODO(SUNDAE-2355): Move to core alongside detectMidnightExtension
// TODO(SUNDAE-2362): Return all compatible wallets and let the user choose
export function detectCardanoExtension(): DetectCardanoWalletResult {
  const cardano = (globalThis as { cardano?: Record<string, Cip30Provider> }).cardano;
  if (!cardano) {
    return { ok: false, reason: 'no-cardano' };
  }
  for (const [key, provider] of Object.entries(cardano)) {
    if (provider && typeof provider === 'object' && typeof provider.enable === 'function' && provider.name) {
      return { ok: true, name: key, provider };
    }
  }
  return { ok: false, reason: 'no-compatible-wallet' };
}

export type ConnectBlazeResult = { ok: true; blaze: Blaze<Provider, Wallet> } | { ok: false; error: string };

export async function connectBlaze(): Promise<ConnectBlazeResult> {
  const detected = detectCardanoExtension();
  if ('reason' in detected) {
    return { ok: false, error: `No Cardano wallet detected (${detected.reason})` };
  }

  try {
    const api = await detected.provider.enable!();
    const webWallet = new WebWallet(api);
    const { provider, network } = createBlockfrostProvider();
    await assertNetworkMatch(webWallet, network);

    const blaze = await Blaze.from(provider, webWallet);
    return { ok: true, blaze: blaze as Blaze<Provider, Wallet> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to connect Cardano wallet' };
  }
}

export async function connectCardanoWallet(): Promise<Blaze<Provider, Wallet>> {
  const result = await connectBlaze();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.blaze;
}

async function assertNetworkMatch(webWallet: WebWallet, configuredNetwork: CardanoNetwork): Promise<void> {
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
