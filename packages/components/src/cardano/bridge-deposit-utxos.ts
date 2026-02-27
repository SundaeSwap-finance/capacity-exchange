import type { Provider } from '@blaze-cardano/sdk';
import { decodeDepositDatum, type DecodedDepositDatum } from './datum';
import { getUtxos, type Utxo } from './utxos';

export interface BridgeDepositUtxo {
  txHash: string;
  index: bigint;
  lovelace: bigint;
  datum: DecodedDepositDatum;
  submittedAt?: number;
}

export interface BridgeDepositUtxosResult {
  address: string;
  utxos: BridgeDepositUtxo[];
}

function toBridgeDepositUtxo(u: Utxo<DecodedDepositDatum>): BridgeDepositUtxo | undefined {
  if (!u.datum?.ok) {
    return undefined;
  }
  return { txHash: u.txHash, index: u.index, lovelace: u.lovelace, datum: u.datum.datum };
}

export async function getBridgeDepositUtxos(
  provider: Provider,
  args: { address: string }
): Promise<BridgeDepositUtxosResult> {
  const result = await getUtxos(provider, { address: args.address, decodeDatum: decodeDepositDatum });
  const utxos = result.utxos.map(toBridgeDepositUtxo).filter((u): u is BridgeDepositUtxo => u != null);

  return {
    address: args.address,
    utxos,
  };
}
