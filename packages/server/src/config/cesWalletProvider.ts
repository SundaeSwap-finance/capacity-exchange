import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
  type ExchangePrice,
  type PromptForCurrency,
  type ConfirmOffer,
  BalanceSealedTx,
} from '@capacity-exchange/components';
import type { WalletConnection } from '@capacity-exchange/midnight-core';
import type { AppEnv } from './env.js';
import type { NetworkEndpoints } from '@capacity-exchange/midnight-core';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

/**
 * Selects the lowest price matching the currency
 */
function createAutoSelectCurrency(currency: string | undefined): PromptForCurrency {
  return async (prices: ExchangePrice[]) => {
    if (prices.length === 0) {
      throw new Error('No exchange prices available');
    }

    const candidates = currency
      ? prices.filter((p) => p.price.currency === currency)
      : prices;

    if (candidates.length === 0) {
      throw new Error(`No exchange prices available for ${currency}`);
    }

    const selected = candidates.reduce((lowest, exchangePrice) =>
      BigInt(exchangePrice.price.amount) < BigInt(lowest.price.amount) ? exchangePrice : lowest
    );
    return { status: 'selected', exchangePrice: selected };
  };
}

const autoConfirmOffer: ConfirmOffer = async () => ({ status: 'confirmed' });

/**
 * Builds a `capacityExchangeWalletProvider` using the server's wallet keys.
 * Auto-selects the currency(defined by the PREFERRED_EXCHANGE_CURRENCY) and confirms offers.
 * Returns null if no peer URLs are configured.
 */
export function buildCesWalletProvider(
  env: AppEnv,
  walletConnection: WalletConnection,
  endpoints: NetworkEndpoints,
): WalletProvider | null {
  if (!env.CAPACITY_EXCHANGE_PEER_URLS) {
    return null;
  }

  const capacityExchangeUrls = env.CAPACITY_EXCHANGE_PEER_URLS.split(',')
    .map((u) => u.trim()).filter(Boolean);
  if (capacityExchangeUrls.length === 0) {
    return null;
  }

  const { walletFacade, keys } = walletConnection;

  const balanceSealedTx: BalanceSealedTx = async (tx) => {
    const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
    const recipe = await walletFacade.balanceFinalizedTransaction(
      tx,
      { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded'] },
    );
    return walletFacade.finalizeRecipe(recipe);
  };

  return capacityExchangeWalletProvider({
    coinPublicKey: keys.shieldedSecretKeys.coinPublicKey,
    encryptionPublicKey: keys.shieldedSecretKeys.encryptionPublicKey,
    balanceSealedTx,
    indexerUrl: endpoints.indexerHttpUrl,
    capacityExchangeUrls,
    margin: DEFAULT_MARGIN,
    promptForCurrency: createAutoSelectCurrency(env.PREFERRED_EXCHANGE_CURRENCY),
    confirmOffer: autoConfirmOffer,
  });
}