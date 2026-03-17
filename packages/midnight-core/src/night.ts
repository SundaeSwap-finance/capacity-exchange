export const SPECKS_PER_NIGHT = 1_000_000n;
export const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

/** Extract the native NIGHT balance from an unshielded balances record. */
export function getNightBalance(unshieldedBalances: Record<string, bigint>): bigint {
  return unshieldedBalances[NIGHT_TOKEN_TYPE] ?? 0n;
}

export function specksToNight(specks: bigint): string {
  return (specks / SPECKS_PER_NIGHT).toLocaleString();
}
