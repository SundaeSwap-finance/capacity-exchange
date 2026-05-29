import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { capacityExchangeWalletProvider, type ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import {
  balanceFinalizedTransaction,
  balanceUnboundTransaction,
  getLedgerParameters,
  uint8ArrayToHex,
} from '@sundaeswap/capacity-exchange-core';
import { Transaction, SignatureEnabled, type Binding, type PreBinding, type Proof } from '@midnight-ntwrk/ledger-v8';

const BALANCE_TTL_MS = 5 * 60 * 1000;

/**
 * Builds a `capacityExchangeWalletProvider` wired to `ctx` for tests, with:
 *  - core's `balanceFinalizedTransaction` / `balanceUnboundTransaction` (signs
 *    balancing tx; balances both shielded and unshielded — required for
 *    unshielded contract collateral AND for unshielded CES payment).
 *  - currency selection that picks `tokenRawId` from `cesUrl`.
 *  - auto-confirm offer.
 */
export function createTestCesProvider(
  ctx: AppContext,
  networkId: string,
  cesUrl: string,
  tokenRawId: string,
) {
  return capacityExchangeWalletProvider({
    networkId,
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.walletContext.walletProvider.getEncryptionPublicKey(),
    balanceUnsealedTransaction: (txHex) => balanceUnsealed(ctx, txHex),
    balanceSealedTransaction: (txHex) => balanceSealed(ctx, txHex),
    chainStateProvider: {
      queryContractState: (addr, cfg) => ctx.publicDataProvider.queryContractState(addr, cfg),
      getLedgerParameters: () => getLedgerParameters(ctx.config.network.endpoints.indexerHttpUrl),
    },
    additionalCapacityExchangeUrls: [cesUrl],
    promptForCurrency: (prices) => selectCurrency(prices, tokenRawId, cesUrl),
    confirmOffer: async () => ({ status: 'confirmed' as const }),
  });
}

async function balanceUnsealed(ctx: AppContext, txHex: string) {
  const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
    'signature',
    'proof',
    'pre-binding',
    Buffer.from(txHex, 'hex'),
  );
  const ttl = new Date(Date.now() + BALANCE_TTL_MS);
  const balancedTx = await balanceUnboundTransaction(ctx.walletContext, tx, ttl);
  return { tx: uint8ArrayToHex(balancedTx.serialize()) };
}

async function balanceSealed(ctx: AppContext, txHex: string) {
  const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    Buffer.from(txHex, 'hex'),
  );
  const ttl = new Date(Date.now() + BALANCE_TTL_MS);
  const balancedTx = await balanceFinalizedTransaction(ctx.walletContext, tx, ttl);
  return { tx: uint8ArrayToHex(balancedTx.serialize()) };
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
