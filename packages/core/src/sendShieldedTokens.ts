import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { WalletKeys } from './keys';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Sends shielded tokens from one address to another.
 *
 * @returns The transaction hash.
 */
export async function sendShieldedTokens(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  type: string,
  receiverAddress: string,
  amount: bigint
): Promise<string> {
  const { shieldedSecretKeys, dustSecretKey } = keys;
  const ttl = new Date(Date.now() + DEFAULT_TTL_MS);

  const recipe = await walletFacade.transferTransaction(
    [
      {
        type: 'shielded',
        outputs: [{ type, receiverAddress, amount }],
      },
    ],
    { shieldedSecretKeys, dustSecretKey },
    { ttl }
  );

  const finalizedTx = await walletFacade.finalizeRecipe(recipe);
  return await walletFacade.submitTransaction(finalizedTx);
}
