import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { SponsoredTransactionsConfig } from './types';
import { createCesApi } from './exchangeApi';
import { requestSponsorship } from './sponsored-transactions-steps';

/**
 * Creates a WalletProvider for the sponsored transactions flow.
 *
 * The returned WalletProvider delegates getCoinPublicKey and getEncryptionPublicKey
 * to the base provider, but replaces balanceTx with logic that sends the proven
 * transaction to the CES server for sponsorship.
 *
 * @param config - Configuration including the base provider and CES server URL
 * @returns A new WalletProvider with sponsored transactions integration
 */
export function sponsoredTransactionsWalletProvider({
  walletProvider,
  capacityExchangeUrl,
}: SponsoredTransactionsConfig): WalletProvider {
  const exchangeApi = createCesApi(capacityExchangeUrl);

  return {
    getCoinPublicKey: () => walletProvider.getCoinPublicKey(),
    getEncryptionPublicKey: () => walletProvider.getEncryptionPublicKey(),

    async balanceTx(tx, _ttl?) {
      console.debug('[SponsoredTransactions] balanceTx called');
      return requestSponsorship(tx, exchangeApi);
    },
  };
}
