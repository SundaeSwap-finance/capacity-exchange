import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { FundedContractsConfig } from './types';
import { createCesApi } from './exchangeApi';
import { requestFunding } from './funded-contracts-steps';

/**
 * Creates a WalletProvider for the funded contracts flow.
 *
 * The returned WalletProvider delegates getCoinPublicKey and getEncryptionPublicKey
 * to the base provider, but replaces balanceTx with logic that sends the proven
 * transaction to the CES server for funding.
 *
 * @param config - Configuration including the base provider and CES server URL
 * @returns A new WalletProvider with funded contracts integration
 */
export function fundedContractsWalletProvider({
  walletProvider,
  capacityExchangeUrl,
}: FundedContractsConfig): WalletProvider {
  const exchangeApi = createCesApi(capacityExchangeUrl);

  return {
    getCoinPublicKey: () => walletProvider.getCoinPublicKey(),
    getEncryptionPublicKey: () => walletProvider.getEncryptionPublicKey(),

    async balanceTx(tx, _ttl?) {
      console.debug('[FundedContracts] balanceTx called');
      return requestFunding(tx, exchangeApi);
    },
  };
}
