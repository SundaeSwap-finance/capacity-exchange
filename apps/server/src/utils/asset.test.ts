import { describe, it, expect } from 'vitest';
import { sameAsset } from './asset.js';

const UNIT = 'aa'.repeat(28) + '534e454b';

describe('sameAsset', () => {
  it('matches ADA held in different objects', () => {
    expect(sameAsset({ type: 'ada' }, { type: 'ada' })).toBe(true);
  });

  it('matches a native asset by its unit', () => {
    expect(sameAsset({ type: 'native', unit: UNIT }, { type: 'native', unit: UNIT })).toBe(true);
  });

  it('tells native assets apart by unit', () => {
    expect(
      sameAsset({ type: 'native', unit: UNIT }, { type: 'native', unit: 'bb'.repeat(28) }),
    ).toBe(false);
  });

  it('tells ADA from a native asset either way round', () => {
    expect(sameAsset({ type: 'ada' }, { type: 'native', unit: UNIT })).toBe(false);
    expect(sameAsset({ type: 'native', unit: UNIT }, { type: 'ada' })).toBe(false);
  });
});
