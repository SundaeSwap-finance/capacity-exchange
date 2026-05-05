import {
  sponsoredTransactionsWalletProvider,
  type SponsoredTransactionsConfig,
} from '@sundaeswap/capacity-exchange-providers';
import { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { useMemo } from 'react';

export { SponsoredTransactionsConfig };

export function useSponsoredTransactionsWalletProvider(config: SponsoredTransactionsConfig): WalletProvider {
  return useMemo(() => {
    return sponsoredTransactionsWalletProvider(config);
  }, [config.coinPublicKey, config.encryptionPublicKey, config.capacityExchangeUrl]);
}
