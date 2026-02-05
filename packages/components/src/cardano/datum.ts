import { Type, serialize, parse } from '@blaze-cardano/data';
import { Core } from '@blaze-cardano/sdk';

export const DepositDatum = Type.Object(
  {
    shieldedMidnightAddress: Type.String(),
  },
  { ctor: 0n }
);

export interface DecodedDepositDatum {
  shieldedMidnightAddress: string;
}

function textToHex(text: string): string {
  return Buffer.from(text, 'utf8').toString('hex');
}

function hexToText(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

export function buildDepositDatum(shieldedMidnightAddress: string): Core.PlutusData {
  const datum = { shieldedMidnightAddress: textToHex(shieldedMidnightAddress) };
  const data = serialize(DepositDatum, datum);
  return Core.PlutusData.fromCbor(Core.HexBlob(data.toCbor()));
}

export function decodeDepositDatum(datumCbor: string): DecodedDepositDatum {
  const plutusData = Core.PlutusData.fromCbor(Core.HexBlob(datumCbor));
  const raw = parse(DepositDatum, plutusData);
  return {
    shieldedMidnightAddress: hexToText(raw.shieldedMidnightAddress),
  };
}
