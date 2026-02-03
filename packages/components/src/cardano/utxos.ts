import { Address } from '@blaze-cardano/core';
import { CardanoConfig } from './config';
import { lovelaceToAda } from './constants';
import { createProvider } from './wallet';

export interface UtxosArgs {
  address: string;
}

export interface Utxo {
  txHash: string;
  index: number;
  lovelace: string;
}

export interface UtxosResult {
  address: string;
  totalLovelace: string;
  totalAda: string;
  count: number;
  utxos: Utxo[];
}

export async function getUtxos(config: CardanoConfig, args: UtxosArgs): Promise<UtxosResult> {
  const provider = createProvider(config);

  const address = Address.fromBech32(args.address);
  const utxos = await provider.getUnspentOutputs(address);

  let totalLovelace = 0n;
  const utxoList: Utxo[] = utxos.map((utxo) => {
    const lovelace = utxo.output().amount().coin();
    totalLovelace += lovelace;
    return {
      txHash: utxo.input().transactionId(),
      index: Number(utxo.input().index()),
      lovelace: lovelace.toString(),
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
