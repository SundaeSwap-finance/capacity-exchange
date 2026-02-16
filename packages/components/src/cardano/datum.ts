import { Type, serialize, parse } from '@blaze-cardano/data';
import { Core } from '@blaze-cardano/sdk';

export const DepositDatum = Type.Object(
  {
    coinPublicKey: Type.String(),
    encryptionPublicKey: Type.String(),
  },
  { ctor: 0n }
);

export interface DecodedDepositDatum {
  coinPublicKey: string;
  encryptionPublicKey: string;
}

export function buildDepositDatum(coinPublicKey: string, encryptionPublicKey: string): Core.PlutusData {
  const datum = { coinPublicKey, encryptionPublicKey };
  const data = serialize(DepositDatum, datum);
  return Core.PlutusData.fromCbor(Core.HexBlob(data.toCbor()));
}

export function decodeDepositDatum(datumCbor: string): DecodedDepositDatum {
  const plutusData = Core.PlutusData.fromCbor(Core.HexBlob(datumCbor));
  const raw = parse(DepositDatum, plutusData);
  return {
    coinPublicKey: raw.coinPublicKey,
    encryptionPublicKey: raw.encryptionPublicKey,
  };
}
