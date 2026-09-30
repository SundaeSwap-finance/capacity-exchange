import { formatAda, formatAsset, short } from '../log.js';

/**
 * A Cardano value: lovelace plus native assets keyed by unit (policy id hex followed by the
 * hex asset name), which is the same string Blockfrost and cardano-cli use.
 */
export interface Value {
  lovelace: bigint;
  assets: Map<string, bigint>;
}

export function emptyValue(): Value {
  return { lovelace: 0n, assets: new Map() };
}

export function lovelaceValue(lovelace: bigint): Value {
  return { lovelace, assets: new Map() };
}

export function cloneValue(value: Value): Value {
  return { lovelace: value.lovelace, assets: new Map(value.assets) };
}

function combine(a: Value, b: Value, sign: bigint): Value {
  const assets = new Map(a.assets);
  for (const [unit, quantity] of b.assets) {
    const next = (assets.get(unit) ?? 0n) + sign * quantity;
    if (next === 0n) {
      assets.delete(unit);
    } else {
      assets.set(unit, next);
    }
  }
  return { lovelace: a.lovelace + sign * b.lovelace, assets };
}

export function addValue(a: Value, b: Value): Value {
  return combine(a, b, 1n);
}

export function subValue(a: Value, b: Value): Value {
  return combine(a, b, -1n);
}

export function sumValues(values: Value[]): Value {
  return values.reduce(addValue, emptyValue());
}

export function valuesEqual(a: Value, b: Value): boolean {
  if (a.lovelace !== b.lovelace) {
    return false;
  }
  const units = new Set([...a.assets.keys(), ...b.assets.keys()]);
  for (const unit of units) {
    if ((a.assets.get(unit) ?? 0n) !== (b.assets.get(unit) ?? 0n)) {
      return false;
    }
  }
  return true;
}

/** Splits a unit into its policy id and hex asset name. */
export function splitUnit(unit: string): { policyId: string; assetNameHex: string } {
  return { policyId: unit.slice(0, 56), assetNameHex: unit.slice(56) };
}

/**
 * cardano-cli's --tx-out spells an asset as `policyId.assetNameHex`, while UTxO JSON and
 * Blockfrost use the two concatenated. Converts our internal (concatenated) unit to the
 * command-line spelling.
 */
export function unitToCliAsset(unit: string): string {
  const { policyId, assetNameHex } = splitUnit(unit);
  return assetNameHex ? `${policyId}.${assetNameHex}` : policyId;
}

/** Renders an asset unit as its ASCII name when printable, else a shortened unit. */
export function assetLabel(unit: string): string {
  const { assetNameHex } = splitUnit(unit);
  const bytes = Buffer.from(assetNameHex, 'hex');
  const ascii = bytes.toString('utf8');
  return /^[\x20-\x7e]+$/.test(ascii) ? ascii : short(unit, 12);
}

/** "1.180000 ADA  +  100.000000 tokenA" */
export function formatValue(value: Value): string {
  const parts = [`${formatAda(value.lovelace)} ADA`];
  for (const [unit, quantity] of value.assets) {
    parts.push(`${formatAsset(quantity)} ${assetLabel(unit)}`);
  }
  return parts.join('  +  ');
}
