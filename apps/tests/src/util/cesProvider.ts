import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { capacityExchangeWalletProvider, type ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import { getLedgerParameters, makeTokenOnlyBalanceFunctions } from '@sundaeswap/capacity-exchange-core';

/**
 * Builds a `capacityExchangeWalletProvider` wired to `ctx` for tests, with:
 *  - `makeTokenOnlyBalanceFunctions` balance functions (excludes dust, matching CES exchange flow requirements).
 *  - currency selection that picks `tokenRawId` from `cesUrl`.
 *  - auto-confirm offer.
 */
export function createTestCesProvider(ctx: AppContext, networkId: string, cesUrl: string, tokenRawId: string) {
  const { balanceUnsealedTransaction, balanceSealedTransaction } = makeTokenOnlyBalanceFunctions(ctx.walletContext);
  return capacityExchangeWalletProvider({
    networkId,
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.walletContext.walletProvider.getEncryptionPublicKey(),
    balanceUnsealedTransaction,
    balanceSealedTransaction,
    chainStateProvider: {
      queryContractState: (addr, cfg) => ctx.publicDataProvider.queryContractState(addr, cfg),
      getLedgerParameters: () => getLedgerParameters(ctx.config.network.endpoints.indexerHttpUrl),
    },
    additionalCapacityExchangeUrls: [cesUrl],
    promptForCurrency: (prices) => selectCurrency(prices, tokenRawId, cesUrl),
    confirmOffer: async () => ({ status: 'confirmed' as const }),
  });
}

async function selectCurrency(prices: ExchangePrice[], tokenRawId: string, cesUrl: string) {
  const matches = prices.filter((p) => p.price.currency.rawId === tokenRawId);
  if (matches.length === 0) {
    const available = prices.map((p) => p.price.currency.rawId).join(', ');
    throw new Error(`CES does not offer currency ${tokenRawId}. Available: ${available}`);
  }
  const match = matches.find((p) => p.exchangeApi.url === cesUrl);
  if (!match) {
    const sources = matches.map((m) => m.exchangeApi.url).join(', ');
    throw new Error(`No exchange at ${cesUrl} returned currency ${tokenRawId}. Matches from: ${sources}`);
  }
  return { status: 'selected' as const, exchangePrice: match };
}
