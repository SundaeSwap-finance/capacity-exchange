import type { UnboundTx, UnprovenTx } from '@midnight-ntwrk/wallet-sdk';
import type { FinalizedTransaction } from '@midnightntwrk/ledger-v9';
import { WalletConnection } from './walletFacade.js';
import { hexToBytes, uint8ArrayToHex } from './hex.js';
import { toFinalized, toUnbound, toUnproven, toWalletTx, type UnboundTransaction } from './walletTx.js';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

type TokenKindsToBalance = 'all' | ('shielded' | 'unshielded' | 'dust')[];

async function signUnprovenTransaction(ctx: WalletConnection, tx: UnprovenTx): Promise<UnprovenTx> {
  if (!toUnproven(tx).intents?.size) {
    return tx;
  }
  return ctx.walletFacade.signUnprovenTransaction(tx, ctx.keys.unshieldedKeystore.signDataAsync);
}

async function signUnboundTransaction(ctx: WalletConnection, tx: UnboundTx): Promise<UnboundTx> {
  if (!toUnbound(tx).intents?.size) {
    return tx;
  }
  return ctx.walletFacade.signUnboundTransaction(tx, ctx.keys.unshieldedKeystore.signDataAsync);
}

const balanceOptions = (ttl: Date, tokenKindsToBalance: TokenKindsToBalance) =>
  tokenKindsToBalance === 'all' ? { ttl } : { ttl, tokenKindsToBalance };

export async function balanceUnboundTransaction(
  ctx: WalletConnection,
  tx: UnboundTransaction,
  ttl: Date,
  tokenKindsToBalance: TokenKindsToBalance
): Promise<FinalizedTransaction> {
  const { walletFacade } = ctx;
  const recipe = await walletFacade.balanceUnboundTransaction(
    toWalletTx(walletFacade, 'Unbound', tx),
    balanceOptions(ttl, tokenKindsToBalance)
  );
  recipe.baseTransaction = await signUnboundTransaction(ctx, recipe.baseTransaction);
  if (recipe.balancingTransaction) {
    recipe.balancingTransaction = await signUnprovenTransaction(ctx, recipe.balancingTransaction);
  }
  return toFinalized(await walletFacade.finalizeRecipe(recipe));
}

export async function balanceFinalizedTransaction(
  ctx: WalletConnection,
  tx: FinalizedTransaction,
  ttl: Date,
  tokenKindsToBalance: TokenKindsToBalance
): Promise<FinalizedTransaction> {
  const { walletFacade } = ctx;
  const recipe = await walletFacade.balanceFinalizedTransaction(
    toWalletTx(walletFacade, 'Finalized', tx),
    balanceOptions(ttl, tokenKindsToBalance)
  );
  if (recipe.balancingTransaction) {
    recipe.balancingTransaction = await signUnprovenTransaction(ctx, recipe.balancingTransaction);
  }
  return toFinalized(await walletFacade.finalizeRecipe(recipe));
}

function makeBalanceFunctionsWithTokenKinds(
  connection: WalletConnection,
  ttlMs: number,
  tokenKindsToBalance: TokenKindsToBalance
) {
  return {
    async balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }> {
      const tx = toUnbound({ serialize: () => hexToBytes(txHex) });
      const balanced = await balanceUnboundTransaction(
        connection,
        tx,
        new Date(Date.now() + ttlMs),
        tokenKindsToBalance
      );
      return { tx: uint8ArrayToHex(balanced.serialize()) };
    },
    async balanceSealedTransaction(txHex: string): Promise<{ tx: string }> {
      const tx = toFinalized({ serialize: () => hexToBytes(txHex) });
      const balanced = await balanceFinalizedTransaction(
        connection,
        tx,
        new Date(Date.now() + ttlMs),
        tokenKindsToBalance
      );
      return { tx: uint8ArrayToHex(balanced.serialize()) };
    },
  };
}

/** Balances both DUST and tokens (shielded + unshielded). Use for wallets that hold DUST. */
export function makeFullBalanceFunctions(connection: WalletConnection, ttlMs = DEFAULT_BALANCE_TTL_MS) {
  return makeBalanceFunctionsWithTokenKinds(connection, ttlMs, 'all');
}

/** Balances shielded and unshielded tokens only — skips DUST. Use for wallets that do not hold DUST. */
export function makeTokenOnlyBalanceFunctions(connection: WalletConnection, ttlMs = DEFAULT_BALANCE_TTL_MS) {
  return makeBalanceFunctionsWithTokenKinds(connection, ttlMs, ['shielded', 'unshielded']);
}
