import type { FastifyBaseLogger } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
  type ExchangePrice,
  type PromptForCurrency,
  type ConfirmOffer,
} from '@capacity-exchange/components';
import type { NetworkEndpoints } from '@capacity-exchange/midnight-core';
import type { WalletService } from '../services/wallet.js';

/**
 * Creates a {@link PromptForCurrency} that selects the best exchange price
 * based on the currencies this server wallet holds.
 *
 * 1. Fetches the server's current sycned shielded token balances
 * 2. Filters the prices to those with non-zero balance
 * 3. Picks the lowest amount among the filtered prices
 *    (fewest tokens spent per dust acquired).
 */
function createAutoSelectCurrency(log: FastifyBaseLogger, walletService: WalletService): PromptForCurrency {
  return async (prices: ExchangePrice[], dustRequired: bigint) => {
    if (prices.length === 0) {
      throw new Error('No exchange prices available');
    }

    log.debug({ dustRequired: dustRequired.toString(), prices: prices.map((p) => ({ currency: p.price.currency, amount: p.price.amount })) }, 'Available exchange prices');

    const balances = await walletService.getShieldedTokenBalances();

    const candidates = prices.filter((p) => (balances[p.price.currency] ?? 0n) > 0n);
    if (candidates.length === 0) {
      throw new Error('No exchange prices available for currencies held by this wallet');
    }

    log.debug({ currencies: candidates.map((p) => p.price.currency) }, 'Currencies with non-zero balance');
    // TODO: allow configuring another selection strategy. 
    const selected = candidates.reduce((lowest, exchangePrice) =>
      BigInt(exchangePrice.price.amount) < BigInt(lowest.price.amount) ? exchangePrice : lowest
    );

    log.info({ currency: selected.price.currency, amount: selected.price.amount }, 'Auto-selected exchange currency');
    return { status: 'selected', exchangePrice: selected };
  };
}

function createAutoConfirmOffer(log: FastifyBaseLogger): ConfirmOffer {
  return async (offer, dustRequired) => {
    log.info({ offerId: offer.offerId, amount: offer.offerAmount, currency: offer.offerCurrency, dustRequired: dustRequired.toString() }, 'Auto-confirming offer');
    return { status: 'confirmed' };
  };
}

/**
 * Builds a `capacityExchangeWalletProvider` using the WalletService.
 * Auto-selects the currency with lowest price.
 * Returns null if no peer URLs are configured.
 */
export function buildCesWalletProvider(
  walletService: WalletService,
  endpoints: NetworkEndpoints,
  capacityExchangeUrls: string[],
  log: FastifyBaseLogger,
): WalletProvider | null {
  if (capacityExchangeUrls.length === 0) {
    return null;
  }

  const { coinPublicKey, encryptionPublicKey } = walletService.shieldedPublicKeys;

  return capacityExchangeWalletProvider({
    coinPublicKey,
    encryptionPublicKey,
    balanceSealedTx: (tx) => walletService.balanceFinalizedTransaction(tx),
    indexerUrl: endpoints.indexerHttpUrl,
    capacityExchangeUrls,
    margin: DEFAULT_MARGIN,
    promptForCurrency: createAutoSelectCurrency(log, walletService),
    confirmOffer: createAutoConfirmOffer(log),
  });
}