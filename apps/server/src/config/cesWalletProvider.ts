import type { FastifyBaseLogger } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  type ChainStateProvider,
} from '@sundaeswap/capacity-exchange-providers';
import type { WalletService } from '../services/wallet.js';
import type { PeerPriceService } from '../services/peerPrice.js';
import { createAutoSelectCurrency } from './peerCurrencySelector.js';
import { createAutoConfirmOffer } from './peerOfferConfirmer.js';

/** Builds the sponsor-fallback `capacityExchangeWalletProvider`: auto-select + auto-confirm. */
export function buildCesWalletProvider(
  walletService: WalletService,
  peerPriceService: PeerPriceService,
  networkId: string,
  chainStateProvider: ChainStateProvider,
  additionalCapacityExchangeUrls: string[],
  log: FastifyBaseLogger,
): WalletProvider {
  const { coinPublicKey, encryptionPublicKey } = walletService.shieldedPublicKeys;

  return capacityExchangeWalletProvider({
    networkId,
    coinPublicKey,
    encryptionPublicKey,
    balanceUnsealedTransaction: (tx) => walletService.balanceUnsealedTransaction(tx),
    balanceSealedTransaction: (tx) => walletService.balanceSealedTransaction(tx),
    chainStateProvider,
    additionalCapacityExchangeUrls,
    promptForCurrency: createAutoSelectCurrency(log, walletService, peerPriceService),
    confirmOffer: createAutoConfirmOffer(log),
  });
}
