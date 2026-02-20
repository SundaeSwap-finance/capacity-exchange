import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

/**
 * Returns the shielded balance for a given token type.
 */
export async function getShieldedBalance(walletFacade: WalletFacade, tokenType: string): Promise<bigint> {
  const state = await walletFacade.shielded.waitForSyncedState();
  return state.balances[tokenType] ?? 0n;
}
