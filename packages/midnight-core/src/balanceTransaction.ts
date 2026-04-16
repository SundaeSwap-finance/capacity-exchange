import { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { WalletConnection } from './walletFacade.js';
import { FinalizedTransaction, UnprovenTransaction } from '@midnight-ntwrk/ledger-v8';

async function signUnprovenTransaction(ctx: WalletConnection, tx: UnprovenTransaction) {
  if (!tx.intents?.size) {
    return tx;
  }
  return ctx.walletFacade.signUnprovenTransaction(tx, (data) => ctx.keys.unshieldedKeystore.signData(data));
}

async function signUnboundTransaction(ctx: WalletConnection, tx: UnboundTransaction): Promise<UnboundTransaction> {
  if (!tx.intents?.size) {
    return tx;
  }
  return ctx.walletFacade.signUnboundTransaction(tx, (data) => ctx.keys.unshieldedKeystore.signData(data));
}

export async function balanceUnboundTransaction(
  ctx: WalletConnection,
  tx: UnboundTransaction,
  ttl: Date
): Promise<FinalizedTransaction> {
  const { walletFacade, keys } = ctx;
  const recipe = await walletFacade.balanceUnboundTransaction(
    tx,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] }
  );
  recipe.baseTransaction = await signUnboundTransaction(ctx, recipe.baseTransaction);
  if (recipe.balancingTransaction) {
    recipe.balancingTransaction = await signUnprovenTransaction(ctx, recipe.balancingTransaction);
  }
  return await walletFacade.finalizeRecipe(recipe);
}

export async function balanceFinalizedTransaction(
  ctx: WalletConnection,
  tx: FinalizedTransaction,
  ttl: Date
): Promise<FinalizedTransaction> {
  const { walletFacade, keys } = ctx;
  const recipe = await walletFacade.balanceFinalizedTransaction(
    tx,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] }
  );
  if (recipe.balancingTransaction) {
    recipe.balancingTransaction = await signUnprovenTransaction(ctx, recipe.balancingTransaction);
  }
  return await walletFacade.finalizeRecipe(recipe);
}
