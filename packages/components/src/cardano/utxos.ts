import { Address } from '@blaze-cardano/core';
import { Provider } from '@blaze-cardano/sdk';
import { lovelaceToAda } from './constants';
import { decodeDepositDatum, DecodedDepositDatum } from './datum';

export interface UtxosArgs {
  address: string;
}

export type DatumDecodeResult =
  | { status: 'success'; cbor: string; decoded: DecodedDepositDatum }
  | { status: 'error'; cbor: string; error: string };

export interface Utxo {
  txHash: string;
  index: number;
  lovelace: string;
  datum?: DatumDecodeResult;
}

export interface UtxosResult {
  address: string;
  totalLovelace: string;
  totalAda: string;
  count: number;
  utxos: Utxo[];
}

export async function getUtxos(provider: Provider, args: UtxosArgs): Promise<UtxosResult> {
  const address = Address.fromBech32(args.address);
  const utxos = await provider.getUnspentOutputs(address);

  let totalLovelace = 0n;
  const utxoList: Utxo[] = utxos.map((utxo) => {
    const lovelace = utxo.output().amount().coin();
    totalLovelace += lovelace;

    const inlineDatum = utxo.output().datum()?.asInlineData();
    const cbor = inlineDatum ? inlineDatum.toCbor() : undefined;

    let datum: DatumDecodeResult | undefined;
    if (cbor) {
      try {
        datum = { status: 'success', cbor, decoded: decodeDepositDatum(cbor) };
      } catch (error) {
        datum = { status: 'error', cbor, error: error instanceof Error ? error.message : String(error) };
      }
    }

    return {
      txHash: utxo.input().transactionId(),
      index: Number(utxo.input().index()),
      lovelace: lovelace.toString(),
      datum,
    };
  });

  return {
    address: args.address,
    totalLovelace: totalLovelace.toString(),
    totalAda: lovelaceToAda(totalLovelace),
    count: utxoList.length,
    utxos: utxoList,
  };
}
