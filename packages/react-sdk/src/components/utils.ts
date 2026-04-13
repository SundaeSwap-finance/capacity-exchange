import { Currency } from '@sundaeswap/capacity-exchange-providers';

const SPECK_PER_DUST = 10n ** 15n;
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function getDustParts(specks: bigint) {
  const whole = specks / SPECK_PER_DUST;
  const remainder = specks % SPECK_PER_DUST;

  if (remainder === 0n) {
    return { whole, decimal: '' };
  }

  const decimal = remainder
    .toString()
    .padStart(SPECK_PER_DUST.toString().length - 1, '0')
    .replace(/0+$/, '');

  return { whole, decimal };
}

// Formats a speck amount as DUST (1 DUST = 10^15 speck).
// For very small fractional values, elides leading zeros with a subscript count:
//   formatDust(1n)                → "0.0₁₄1"
//   formatDust(123_000_000n)      → "0.0₅123"
//   formatDust(10_000_000_000_000n) → "0.01"
//   formatDust(1_000_000_000_000_000n) → "1"
export function formatDust(specks: bigint): string {
  const { whole, decimal } = getDustParts(specks);

  if (!decimal) {
    return whole.toLocaleString();
  }

  const significant = decimal.replace(/^0+/, '');
  const leadingZeros = decimal.length - significant.length;

  if (leadingZeros > 2) {
    const subscript = [...leadingZeros.toString()].map((d) => SUBSCRIPT_DIGITS[+d]).join('');
    return `${whole.toLocaleString()}.0${subscript}${significant}`;
  }

  return `${whole.toLocaleString()}.${decimal}`;
}

export function currencyName(currency: Currency): string {
  return currency.rawId;
}

export function currencyTitle(currency: Currency): string {
  return `${currency.type} token ${currency.rawId}`;
}
