import { parse, serialize, Type } from '@blaze-cardano/data';
import { Core } from '@blaze-cardano/sdk';

export const DepositDatum = Type.Object(
  {
    coinPublicKey: Type.String(),
  },
  { ctor: 0n }
);

export interface DecodedDepositDatum {
  coinPublicKey: string;
}

export function buildDepositDatum(coinPublicKey: string): Core.PlutusData {
  const datum = { coinPublicKey };
  const data = serialize(DepositDatum, datum);
  return Core.PlutusData.fromCbor(Core.HexBlob(data.toCbor()));
}

export function decodeDepositDatum(datumCbor: string): DecodedDepositDatum {
  const plutusData = Core.PlutusData.fromCbor(Core.HexBlob(datumCbor));
  const raw = parse(DepositDatum, plutusData);
  return {
    coinPublicKey: raw.coinPublicKey,
  };
}
