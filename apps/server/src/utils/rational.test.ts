import { describe, it, expect } from 'vitest';
import { addRational, ceilRational, scaleRational, ZERO, type Rational } from './rational.js';

const r = (numerator: bigint, denominator = 1n): Rational => ({ numerator, denominator });

describe('addRational', () => {
  it('adds over a common denominator, reduced', () => {
    expect(addRational(r(1n, 6n), r(1n, 3n))).toEqual(r(1n, 2n));
  });

  it('treats ZERO as the identity', () => {
    expect(addRational(ZERO, r(3n, 7n))).toEqual(r(3n, 7n));
  });

  it('keeps zero as 0/1', () => {
    expect(addRational(r(1n, 4n), r(-1n, 4n))).toEqual(r(0n, 1n));
  });
});

describe('scaleRational', () => {
  it('multiplies by a whole number, reduced', () => {
    expect(scaleRational(r(13n, 1000n), 200n)).toEqual(r(13n, 5n));
  });

  it('stays exact past 2^53', () => {
    expect(scaleRational(r(1n, 3n), 45_000_000_000_000_000n)).toEqual(r(15_000_000_000_000_000n));
  });
});

describe('ceilRational', () => {
  it('rounds a fraction up', () => {
    expect(ceilRational(r(7n, 2n))).toBe(4n);
  });

  it('leaves a whole number alone', () => {
    expect(ceilRational(r(8n, 2n))).toBe(4n);
    expect(ceilRational(ZERO)).toBe(0n);
  });

  it('rounds a negative fraction toward zero', () => {
    expect(ceilRational(r(-7n, 2n))).toBe(-3n);
  });
});
