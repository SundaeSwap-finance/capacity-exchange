import type pino from 'pino';
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
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { AppEnv } from './env.js';
import type { NetworkEndpoints } from '@capacity-exchange/midnight-core';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

/**
 * Creates a {@link PromptForCurrency} that selects the best exchange price
 * based on the currencies this server wallet holds.
 *
 * Selection algorithm:
 * 1. Fetch the wallet's current synced shielded state to get token balances.
 * 2. Filter the incoming `prices` to currencies in the wallet with non-zero SHIELDED balance.
 * 3. Among the remaining candidates, pick the one with the lowest price amount
 *    (fewest tokens spent per dust acquired).
 *
 * Throws if no prices are provided, or if none of the offered currencies are
 * held by this wallet.
 */
function createAutoSelectCurrency(log: pino.Logger, walletFacade: WalletFacade): PromptForCurrency {
  return async (prices: ExchangePrice[], dustRequired: bigint) => {
    if (prices.length === 0) {
      throw new Error('No exchange prices available');
    }

    log.debug({ dustRequired: dustRequired.toString(), prices: prices.map((p) => ({ currency: p.price.currency, amount: p.price.amount })) }, 'Available exchange prices');

    const shieldedState = await walletFacade.shielded.waitForSyncedState();
    const balances = shieldedState.balances;

    const candidates = prices.filter((p) => (balances[p.price.currency] ?? 0n) > 0n);
    if (candidates.length === 0) {
      throw new Error('No exchange prices available for currencies held by this wallet');
    }

    log.debug({ currencies: candidates.map((p) => p.price.currency) }, 'Currencies with non-zero balance');

    const selected = candidates.reduce((lowest, exchangePrice) =>
      BigInt(exchangePrice.price.amount) < BigInt(lowest.price.amount) ? exchangePrice : lowest
    );

    log.info({ currency: selected.price.currency, amount: selected.price.amount }, 'Auto-selected exchange currency');
    return { status: 'selected', exchangePrice: selected };
  };
}

function createAutoConfirmOffer(log: pino.Logger): ConfirmOffer {
  return async (offer, dustRequired) => {
    log.info({ offerId: offer.offerId, amount: offer.offerAmount, currency: offer.offerCurrency, dustRequired: dustRequired.toString() }, 'Auto-confirming offer');
    return { status: 'confirmed' };
  };
}

/**
 * Builds a `capacityExchangeWalletProvider` using the server's wallet keys.
 * Auto-selects the currency of the lowest price and confirms offers.
 * Returns null if no peer URLs are configured.
 */
export function buildCesWalletProvider(
  env: AppEnv,
  log: pino.Logger,
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
    promptForCurrency: createAutoSelectCurrency(log, walletFacade),
    confirmOffer: createAutoConfirmOffer(log),
  });
}