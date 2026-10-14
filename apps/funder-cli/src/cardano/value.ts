import { splitUnit, type Value } from '@sundaeswap/capacity-exchange-cardano-tx';
import { formatAda, formatAsset, short } from '../log.js';

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
