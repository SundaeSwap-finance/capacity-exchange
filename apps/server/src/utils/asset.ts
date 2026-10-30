/** A Cardano asset: ADA, or a native asset by its unit, the policy id followed by the hex asset name. */
export type Asset = { type: 'ada' } | { type: 'native'; unit: string };

/** Whether `a` and `b` name the same asset, whichever objects hold them. */
export function sameAsset(a: Asset, b: Asset): boolean {
  if (a.type === 'ada' || b.type === 'ada') {
    return a.type === b.type;
  }
  return a.unit === b.unit;
}
