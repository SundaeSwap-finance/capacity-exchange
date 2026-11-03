import type { Asset } from '@capacity-exchange/cardano-core';

export type { Asset };

/** Whether `a` and `b` name the same asset, whichever objects hold them. */
export function sameAsset(a: Asset, b: Asset): boolean {
  if (a.type === 'ada' || b.type === 'ada') {
    return a.type === b.type;
  }
  return a.unit === b.unit;
}
