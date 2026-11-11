import type { WalletData } from '../features/wallet/types';

/** Shielded balance of the tutorial token minted by the active contract. */
export function getTutorialTokenBalance(walletData: WalletData | null, tokenColor: string | null): bigint {
  if (!walletData || !tokenColor) {
    return 0n;
  }
  return walletData.shieldedBalances[tokenColor] ?? 0n;
}
