import { sponsoredTransactionsWalletProvider } from '@sundaeswap/capacity-exchange-providers';
import { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { useMemo } from 'react';

export interface SponsoredTransactionConfig {
  coinPublicKey: string;
  encryptionPublicKey: string;
  capacityExchangeUrl: string;
}

export function useSponsoredTransactionsWalletProvider(config: SponsoredTransactionConfig): WalletProvider {
  return useMemo(() => {
    return sponsoredTransactionsWalletProvider(config);
  }, [config.coinPublicKey, config.encryptionPublicKey, config.capacityExchangeUrl]);
}
