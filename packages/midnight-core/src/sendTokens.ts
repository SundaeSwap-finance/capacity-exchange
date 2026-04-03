import type {
  WalletFacade,
  TokenTransfer,
  BalancingRecipe,
  ShieldedTokenTransfer,
  UnshieldedTokenTransfer,
} from '@midnight-ntwrk/wallet-sdk-facade';
import type { ShieldedAddress, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { WalletKeys } from './keys.js';

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

async function executeTransfer(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  transfers: (ShieldedTokenTransfer | UnshieldedTokenTransfer)[],
  sign: boolean
): Promise<string> {
  const { shieldedSecretKeys, dustSecretKey } = keys;
  const ttl = new Date(Date.now() + DEFAULT_TTL_MS);

  let recipe: BalancingRecipe = await walletFacade.transferTransaction(
    transfers,
    { shieldedSecretKeys, dustSecretKey },
    { ttl }
  );

  if (sign) {
    recipe = await walletFacade.signRecipe(recipe, (payload: Uint8Array) => keys.unshieldedKeystore.signData(payload));
  }

  const finalizedTx = await walletFacade.finalizeRecipe(recipe);
  return await walletFacade.submitTransaction(finalizedTx);
}

/** Sends shielded tokens to one or more outputs. */
export function sendShieldedTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  outputs: TokenTransfer<ShieldedAddress>[]
): Promise<string> {
  return executeTransfer(walletFacade, keys, [{ type: 'shielded', outputs }], false);
}

/** Sends unshielded tokens to one or more outputs, signing with the unshielded keystore. */
export function sendUnshieldedTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  outputs: TokenTransfer<UnshieldedAddress>[]
): Promise<string> {
  return executeTransfer(walletFacade, keys, [{ type: 'unshielded', outputs }], true);
}
