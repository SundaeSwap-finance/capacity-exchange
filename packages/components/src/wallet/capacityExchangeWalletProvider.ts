import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  ApiOffersPost201Response,
  Configuration,
  DefaultApi,
  ResponseError,
} from '@capacity-exchange/client';
import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type Binding,
  type UnprovenTransaction
} from '@midnight-ntwrk/ledger-v6';

import type { CapacityExchangeConfig, Offer, Price } from './types';
import {
  CapacityExchangeUserCancelledError,
  CapacityExchangeOfferExpiredError,
  CapacityExchangeServerError
} from './errors';
import { isOfferExpired, getLedgerParameters, hexToUint8Array, uint8ArrayToHex } from './utils';

/**
 * Wraps a CES API call to translate ResponseError into CapacityExchangeServerError.
 */
async function wrapCesApi<T>(cesApi: () => Promise<T>): Promise<T> {
  try {
    return await cesApi();
  } catch (e) {
    if (!(e instanceof ResponseError)) throw e;

    // Handle ResponseError
    const errorText = await e.response.text().catch(() => 'Unknown error');
    throw new CapacityExchangeServerError(e.response.status, errorText);
  }
}

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
export function capacityExchangeWalletProvider(
  config: CapacityExchangeConfig
): WalletProvider {
  const {
    walletProvider,
    connectedAPI,
    proofProvider,
    capacityExchangeUrl,
    indexerUrl,
    promptForCurrency,
    confirmOffer,
  } = config;

  const apiConfig = new Configuration({ basePath: capacityExchangeUrl });
  const api = new DefaultApi(apiConfig);

  return {
    getCoinPublicKey: () => walletProvider.getCoinPublicKey(),
    getEncryptionPublicKey: () => walletProvider.getEncryptionPublicKey(),

    async balanceTx(tx: UnprovenTransaction, newCoins, ttl) {
      console.debug('[CapacityExchange] balanceTx called');
      console.debug('[CapacityExchange] Fetching ledger parameters from:', indexerUrl);
      const ledgerParameters = await getLedgerParameters(indexerUrl);
      // TODO: Determine the correct value for margin
      const margin = 3;
      const dustRequired: bigint = tx.feesWithMargin(ledgerParameters, margin);
      console.debug('[CapacityExchange] DUST required:', dustRequired);

      console.debug('[CapacityExchange] Fetching prices from:', capacityExchangeUrl);
      const priceResponse = await wrapCesApi(() =>
        api.apiPricesGet({ dust: dustRequired.toString() })
      );
      console.debug('[CapacityExchange] Prices received:', priceResponse.prices);

      let confirmedOffer: Offer | null = null;
      while (confirmedOffer === null) {
        console.debug('[CapacityExchange] Prompting user for currency selection');
        const currencyResult = await promptForCurrency(priceResponse.prices, dustRequired);
        if (currencyResult.status === 'cancelled') {
          console.debug('[CapacityExchange] User cancelled currency selection');
          throw new CapacityExchangeUserCancelledError();
        }
        console.debug('[CapacityExchange] User selected currency:', currencyResult.currency);

        console.debug('[CapacityExchange] Requesting offer from server');
        const offerResponse = await wrapCesApi(() =>
          api.apiOffersPost({
            apiOffersPostRequest: {
              requestAmount: dustRequired.toString(),
              offerCurrency: currencyResult.currency,
            }
          })
        );
        console.debug('[CapacityExchange] Offer received:', offerResponse);

        const offer: Offer = {
          offerId: offerResponse.offerId,
          offerAmount: offerResponse.offerAmount,
          offerCurrency: offerResponse.offerCurrency,
          serializedTx: offerResponse.serializedTx,
          expiresAt: offerResponse.expiresAt.toISOString()
        };

        if (isOfferExpired(offer.expiresAt)) {
          console.debug('[CapacityExchange] Offer already expired');
          throw new CapacityExchangeOfferExpiredError(offer);
        }

        console.debug('[CapacityExchange] Prompting user to confirm offer');
        const confirmResult = await confirmOffer(offer, dustRequired);
        if (confirmResult.status === 'cancelled') {
          console.debug('[CapacityExchange] User cancelled');
          throw new CapacityExchangeUserCancelledError();
        }
        if (confirmResult.status === 'back') {
          console.debug('[CapacityExchange] User went back to currency selection');
          continue;
        }
        console.debug('[CapacityExchange] User confirmed offer');

        if (isOfferExpired(offer.expiresAt)) {
          console.debug('[CapacityExchange] Offer expired during confirmation');
          throw new CapacityExchangeOfferExpiredError(offer);
        }
        confirmedOffer = offer;
      }

      console.debug('[CapacityExchange] Deserializing DUST transaction from offer');
      const txBytes = hexToUint8Array(confirmedOffer.serializedTx);
      const dustTx = Transaction.deserialize<
        SignatureEnabled,
        Proof,
        PreBinding
      >("signature", "proof", "pre-binding", txBytes).bind();
      console.debug('[CapacityExchange] DUST transaction deserialized');

      console.debug('[CapacityExchange] Proving user transaction');
      const provenTx = (await proofProvider.proveTx(tx)).bind();
      console.debug('[CapacityExchange] User transaction proven');

      console.debug('[CapacityExchange] Merging transactions');
      const mergedTx = provenTx.merge(dustTx);
      const serialized = mergedTx.serialize();
      const serializedStr = uint8ArrayToHex(serialized);
      console.debug('[CapacityExchange] Transactions merged, calling wallet to balance and seal');

      const result = await connectedAPI.balanceSealedTransaction(serializedStr);
      console.debug('[CapacityExchange] Wallet balanced and sealed transaction');

      const resultBytes = hexToUint8Array(result.tx);
      const transaction = Transaction.deserialize<
        SignatureEnabled,
        Proof,
        Binding
      >("signature", "proof", "binding", resultBytes).bind();

      console.debug('[CapacityExchange] balanceTx completed successfully');
      return {
        transaction,
        type: 'NothingToProve' as const,
      };
    },
  };
}
