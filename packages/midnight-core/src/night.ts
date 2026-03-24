export const SPECKS_PER_NIGHT = 1_000_000n;
export const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

/** Extract the native NIGHT balance from an unshielded balances record. */
export function getNightBalance(unshieldedBalances: Record<string, bigint>): bigint {
  return unshieldedBalances[NIGHT_TOKEN_TYPE] ?? 0n;
}

export function specksToNight(specks: bigint): string {
  return (specks / SPECKS_PER_NIGHT).toLocaleString();
}

export interface TokenBalance {
  color: string;
  amount: bigint;
}

/**
 * Extract structured balances from a Map-like balance object (as returned by ConnectedAPI).
 * Returns the NIGHT balance (empty-string key) and a list of other token balances.
 */
export function extractBalances(balances: unknown): { night: bigint; tokens: TokenBalance[] } {
  let night = 0n;
  const tokens: TokenBalance[] = [];

  if (!balances) return { night, tokens };

  const map = balances as Map<string, bigint>;
  if (typeof map.forEach !== 'function') return { night, tokens };

  map.forEach((amount, color) => {
    const amountBigInt = BigInt(amount);
    if (color === '') {
      night = amountBigInt;
    } else {
      tokens.push({ color, amount: amountBigInt });
    }
  });

  return { night, tokens };
}
