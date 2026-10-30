/** An exact fraction of bigints. */
export interface Rational {
  numerator: bigint;
  /** Always positive. */
  denominator: bigint;
}

export const ZERO: Rational = { numerator: 0n, denominator: 1n };

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function reduced(numerator: bigint, denominator: bigint): Rational {
  const divisor = gcd(numerator, denominator) || 1n;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function addRational(a: Rational, b: Rational): Rational {
  return reduced(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

/** `r` times the whole number `n`. */
export function scaleRational(r: Rational, n: bigint): Rational {
  return reduced(r.numerator * n, r.denominator);
}

/** The least whole number at or above `r`. */
export function ceilRational(r: Rational): bigint {
  const quotient = r.numerator / r.denominator;
  // bigint division truncates toward zero, which already rounds a negative fraction up.
  return r.numerator % r.denominator > 0n ? quotient + 1n : quotient;
}
