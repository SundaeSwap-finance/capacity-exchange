import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { UnprovenTransaction, ShieldedCoinInfo } from '@midnight-ntwrk/ledger-v6';
import type { CapacityExchangeConfig } from './types';
import { DEFAULT_MARGIN } from './types';
import { getLedgerParameters } from './utils';
import { createExchangeApis } from './exchangeApi';
import { fetchPricesFromExchanges } from './priceService';
import { selectAndConfirmOffer } from './offerService';
import { processTransactionWithOffer } from './transactionService';
import {
  CapacityExchangeUserCancelledError,
  CapacityExchangeOfferExpiredError,
  CapacityExchangeNoPricesAvailableError,
} from './errors';

/**
 * Creates a WalletProvider with Capacity Exchange functionality.
 *
 * The returned WalletProvider delegates getCoinPublicKey and getEncryptionPublicKey
 * to the base provider, but replaces balanceTx with logic that acquires DUST
 * through the Capacity Exchange server.
 *
 * @param config - Configuration including the base provider and callbacks
 * @returns A new WalletProvider with Capacity Exchange integration
 */
export function capacityExchangeWalletProvider(config: CapacityExchangeConfig): WalletProvider {
  const {
    walletProvider,
    connectedAPI,
    proofProvider,
    zkConfigProvider,
    capacityExchangeUrls,
    indexerUrl,
    margin,
    promptForCurrency,
    confirmOffer,
    circuitId,
  } = config;

  const exchangeApis = createExchangeApis(capacityExchangeUrls);

  return {
    getCoinPublicKey: () => walletProvider.getCoinPublicKey(),
    getEncryptionPublicKey: () => walletProvider.getEncryptionPublicKey(),

    async balanceTx(tx: UnprovenTransaction, _newCoins?: ShieldedCoinInfo[], _ttl?: Date) {
      console.debug('[CapacityExchange] balanceTx called');
      console.debug('[CapacityExchange] Tx identifiers:', tx.identifiers());

      // Calculate DUST required for transaction
      console.debug('[CapacityExchange] Fetching ledger parameters from:', indexerUrl);
      const ledgerParameters = await getLedgerParameters(indexerUrl);
      console.debug('[CapacityExchange] Ledger parameters received', ledgerParameters);
      const dustRequired: bigint = tx.feesWithMargin(ledgerParameters, margin ?? DEFAULT_MARGIN);
      console.debug('[CapacityExchange] DUST required (with margin):', dustRequired.toString());

      // Fetch prices from all exchanges
      const allPrices = await fetchPricesFromExchanges(exchangeApis, dustRequired);

      // Check if we have any prices available
      if (allPrices.length === 0) {
        throw new CapacityExchangeNoPricesAvailableError();
      }

      // User selects currency and confirms offer
      const result = await selectAndConfirmOffer(allPrices, dustRequired, promptForCurrency, confirmOffer);

      switch (result.status) {
        case 'success': {
          console.debug('[CapacityExchange] User confirmed offer, processing transaction');
          console.debug('[CapacityExchange] Offer details:', {
            offerId: result.offer.offerId,
            amount: result.offer.offerAmount,
            currency: result.offer.offerCurrency,
            expiresAt: result.offer.expiresAt.toISOString(),
          });
          const zkConfig = await zkConfigProvider.get(circuitId);
          console.debug('[CapacityExchange] zkConfig fetched, zkConfig.circuitId:', zkConfig.circuitId);
          return processTransactionWithOffer(tx, result.offer, proofProvider, connectedAPI, zkConfig);
        }
        case 'userCancelled':
          throw new CapacityExchangeUserCancelledError();
        case 'offerExpired':
          throw new CapacityExchangeOfferExpiredError(result.offer);
      }
    },
  };
}
