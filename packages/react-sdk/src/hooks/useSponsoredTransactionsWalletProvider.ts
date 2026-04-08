import { sponsoredTransactionsWalletProvider } from '@capacity-exchange/providers';
import { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { useMemo } from 'react';

export interface SponsoredTransactionConfig {
  walletProvider: WalletProvider;
  capacityExchangeUrl: string;
}

export function useSponsoredTransactionsWalletProvider(config: SponsoredTransactionConfig): WalletProvider {
  return useMemo(() => {
    return sponsoredTransactionsWalletProvider(config);
  }, [config.walletProvider, config.capacityExchangeUrl]);
}
