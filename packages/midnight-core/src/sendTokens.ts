import type { WalletFacade, TokenTransfer, BalancingRecipe } from '@midnight-ntwrk/wallet-sdk-facade';
import type { WalletKeys } from './keys.js';

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Sends tokens to one or more outputs. Unshielded transfers are signed with the unshielded keystore.
 *
 * @returns The transaction hash.
 */
export async function sendTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  type: 'shielded' | 'unshielded',
  outputs: TokenTransfer[]
): Promise<string> {
  if (outputs.length === 0) {
    throw new Error('outputs must not be empty');
  }

  const { shieldedSecretKeys, dustSecretKey } = keys;
  const ttl = new Date(Date.now() + DEFAULT_TTL_MS);

  let recipe: BalancingRecipe = await walletFacade.transferTransaction(
    [{ type, outputs }],
    { shieldedSecretKeys, dustSecretKey },
    { ttl }
  );

  if (type === 'unshielded') {
    recipe = await walletFacade.signRecipe(recipe, (payload: Uint8Array) => keys.unshieldedKeystore.signData(payload));
  }

  const finalizedTx = await walletFacade.finalizeRecipe(recipe);
  return await walletFacade.submitTransaction(finalizedTx);
}

/** Sends shielded tokens to one or more outputs. */
export function sendShieldedTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  outputs: TokenTransfer[]
): Promise<string> {
  return sendTokens(walletFacade, keys, 'shielded', outputs);
}

/** Sends unshielded tokens to one or more outputs, signing with the unshielded keystore. */
export function sendUnshieldedTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  outputs: TokenTransfer[]
): Promise<string> {
  return sendTokens(walletFacade, keys, 'unshielded', outputs);
}
