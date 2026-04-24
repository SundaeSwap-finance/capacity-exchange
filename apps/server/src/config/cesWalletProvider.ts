import type { FastifyBaseLogger } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  type ChainStateProvider,
  type Currency,
} from '@sundaeswap/capacity-exchange-providers';
import type { WalletService } from '../services/wallet.js';
import type { PeerPriceService } from '../services/peerPrice.js';
import { createAutoSelectCurrency, fixedCurrencySelector } from './peerCurrencySelector.js';
import { createAutoConfirmOffer } from './peerOfferConfirmer.js';

/**
 * Defines which `PromptForCurrency` to use when buying DUST from a peer CES.
 *
 * - `auto`  — picks the cheapest eligible offer across ALL currencies in `peer.maxPrices`.
 * - `fixed` — restricts selection to a single currency, pre-filtering prices beforehand.
 *             Automatically inferred when `peer.maxPrices` has only ONE entry.
 */
export type CurrencySelection = { mode: 'auto' } | { mode: 'fixed'; currency: Currency };

/** Builds the sponsor-fallback `capacityExchangeWalletProvider`: auto-select + auto-confirm. */
export function buildCesWalletProvider(
  walletService: WalletService,
  peerPriceService: PeerPriceService,
  networkId: string,
  chainStateProvider: ChainStateProvider,
  additionalCapacityExchangeUrls: string[],
  log: FastifyBaseLogger,
  currencySelection: CurrencySelection = { mode: 'auto' },
): WalletProvider {
  const { coinPublicKey, encryptionPublicKey } = walletService.shieldedPublicKeys;

  const fixedCurrency = currencySelection.mode === 'fixed' ? currencySelection.currency : undefined;

  return capacityExchangeWalletProvider({
    networkId,
    coinPublicKey,
    encryptionPublicKey,
    balanceUnsealedTransaction: (tx) => walletService.balanceUnsealedTransaction(tx),
    balanceSealedTransaction: (tx) => walletService.balanceSealedTransaction(tx),
    chainStateProvider,
    additionalCapacityExchangeUrls,
    currency: fixedCurrency,
    promptForCurrency: fixedCurrency
      ? fixedCurrencySelector(log, walletService, peerPriceService, fixedCurrency)
      : createAutoSelectCurrency(log, walletService, peerPriceService),
    confirmOffer: createAutoConfirmOffer(log),
  });
}
