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
const SPECKS_PER_DUST = 10n ** 15n;
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// Formats a speck amount as DUST (1 DUST = 10^15 speck).
// For very small fractional values, elides leading zeros with a subscript count:
//   formatDust(1n)                → "0.0₁₄1"
//   formatDust(123_000_000n)      → "0.0₅123"
//   formatDust(10_000_000_000_000n) → "0.01"
//   formatDust(1_000_000_000_000_000n) → "1"
export function formatDust(specks: bigint): string {
  const whole = specks / SPECKS_PER_DUST;
  const remainder = specks % SPECKS_PER_DUST;

  if (remainder === 0n) {
    return whole.toLocaleString();
  }

  const decimal = remainder
    .toString()
    .padStart(SPECKS_PER_DUST.toString().length - 1, '0')
    .replace(/0+$/, '');
  const significant = decimal.replace(/^0+/, '');
  const leadingZeros = decimal.length - significant.length;

  if (leadingZeros > 2) {
    const subscript = [...leadingZeros.toString()].map((d) => SUBSCRIPT_DIGITS[+d]).join('');
    return `${whole.toLocaleString()}.0${subscript}${significant}`;
  }

  return `${whole.toLocaleString()}.${decimal}`;
}

export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function formatTimeRemaining(expiresAt: Date): string {
  const remaining = expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    return 'Expired';
  }
  return formatElapsed(remaining);
}

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
