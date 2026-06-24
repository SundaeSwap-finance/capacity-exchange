import { UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import { WalletConnection } from './walletFacade.js';
import {
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type Binding,
  Transaction,
  FinalizedTransaction,
  UnprovenTransaction,
} from '@midnight-ntwrk/ledger-v8';
import { hexToBytes, uint8ArrayToHex } from './hex.js';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

type TokenKindsToBalance = 'all' | ('shielded' | 'unshielded' | 'dust')[];

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
  ttl: Date,
  tokenKindsToBalance: TokenKindsToBalance
): Promise<FinalizedTransaction> {
  const { walletFacade, keys } = ctx;
  const recipe = await walletFacade.balanceUnboundTransaction(
    tx,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    tokenKindsToBalance === 'all' ? { ttl } : { ttl, tokenKindsToBalance }
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
  ttl: Date,
  tokenKindsToBalance: TokenKindsToBalance
): Promise<FinalizedTransaction> {
  const { walletFacade, keys } = ctx;
  const recipe = await walletFacade.balanceFinalizedTransaction(
    tx,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    tokenKindsToBalance === 'all' ? { ttl } : { ttl, tokenKindsToBalance }
  );
  if (recipe.balancingTransaction) {
    recipe.balancingTransaction = await signUnprovenTransaction(ctx, recipe.balancingTransaction);
  }
  return await walletFacade.finalizeRecipe(recipe);
}

function makeBalanceFunctionsWithTokenKinds(
  connection: WalletConnection,
  ttlMs: number,
  tokenKindsToBalance: TokenKindsToBalance
) {
  return {
    async balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }> {
      const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
        'signature',
        'proof',
        'pre-binding',
        hexToBytes(txHex)
      );
      const balanced = await balanceUnboundTransaction(
        connection,
        tx,
        new Date(Date.now() + ttlMs),
        tokenKindsToBalance
      );
      return { tx: uint8ArrayToHex(balanced.serialize()) };
    },
    async balanceSealedTransaction(txHex: string): Promise<{ tx: string }> {
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        hexToBytes(txHex)
      ).bind();
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
