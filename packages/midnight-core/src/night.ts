export const SPECKS_PER_NIGHT = 1_000_000n;
export const NIGHT_TOKEN_TYPE =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Extract the native NIGHT balance from an unshielded balances record. */
export function getNightBalance(
  unshieldedBalances: Record<string, bigint>,
): bigint {
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
 * Extract structured balances from a balance record.
 * Returns the NIGHT balance and a list of other token balances.
 */
export function extractBalances(
  balances: Record<string, bigint>,
): { night: bigint; tokens: TokenBalance[] } {
  const { [NIGHT_TOKEN_TYPE]: night = 0n, ...rest } = balances;
  return {
    night,
    tokens: Object.entries(rest).map(([color, amount]) => ({ color, amount })),
  };
}
