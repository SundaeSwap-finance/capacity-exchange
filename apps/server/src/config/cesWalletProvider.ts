import type { FastifyBaseLogger } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  type ChainStateProvider,
  type PromptForCurrency,
} from '@sundaeswap/capacity-exchange-providers';
import type { WalletService } from '../services/wallet.js';
import { createAutoConfirmOffer } from './peerOfferConfirmer.js';

/** Builds the sponsor-fallback `capacityExchangeWalletProvider` with auto-confirm. */
export function buildCesWalletProvider(
  walletService: WalletService,
  networkId: string,
  chainStateProvider: ChainStateProvider,
  additionalCapacityExchangeUrls: string[],
  log: FastifyBaseLogger,
  promptForCurrency: PromptForCurrency,
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
    promptForCurrency,
    confirmOffer: createAutoConfirmOffer(log),
  });
}
