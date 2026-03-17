const SPECK_PER_DUST = 10n ** 15n;
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// Formats a speck amount as DUST (1 DUST = 10^15 speck).
// For very small fractional values, elides leading zeros with a subscript count:
//   formatDust(1n)                → "0.0₁₄1"
//   formatDust(123_000_000n)      → "0.0₅123"
//   formatDust(10_000_000_000_000n) → "0.01"
//   formatDust(1_000_000_000_000_000n) → "1"
export function formatDust(specks: bigint): string {
  const whole = specks / SPECK_PER_DUST;
  const remainder = specks % SPECK_PER_DUST;

  if (remainder === 0n) {
    return whole.toLocaleString();
  }

  const decimal = remainder
    .toString()
    .padStart(SPECK_PER_DUST.toString().length - 1, '0')
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

export function truncateMiddle(str: string, startChars = 8, endChars = 8): string {
  if (str.length <= startChars + endChars + 3) {
    return str;
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}
