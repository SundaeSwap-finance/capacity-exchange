import { Address, type TransactionUnspentOutput } from '@blaze-cardano/core';
import type { Provider } from '@blaze-cardano/sdk';

export type DatumDecodeResult<D> = { ok: true; datum: D } | { ok: false; error: string };

export interface Utxo<D> {
  txHash: string;
  index: bigint;
  lovelace: bigint;
  datum?: DatumDecodeResult<D>;
}

export interface UtxosResult<D> {
  address: string;
  utxos: Utxo<D>[];
}

function parseUtxo<D>(raw: TransactionUnspentOutput, decodeDatum?: (cbor: string) => D): Utxo<D> {
  const lovelace = raw.output().amount().coin();

  let datum: DatumDecodeResult<D> | undefined;
  if (decodeDatum) {
    const inlineDatum = raw.output().datum()?.asInlineData();
    if (!inlineDatum) {
      datum = { ok: false, error: 'no inline datum' };
    } else {
      try {
        datum = { ok: true, datum: decodeDatum(inlineDatum.toCbor()) };
      } catch (err) {
        datum = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  return {
    txHash: raw.input().transactionId(),
    index: raw.input().index(),
    lovelace,
    datum,
  };
}

export function sumLovelace(utxos: { lovelace: bigint }[]): bigint {
  return utxos.reduce((sum, u) => sum + u.lovelace, 0n);
}

export async function getUtxos<D>(
  provider: Provider,
  args: { address: string; decodeDatum?: (cbor: string) => D }
): Promise<UtxosResult<D>> {
  const address = Address.fromBech32(args.address);
  const rawUtxos = await provider.getUnspentOutputs(address);

  const utxos = rawUtxos.map((raw) => parseUtxo(raw, args.decodeDatum));

  return {
    address: args.address,
    utxos,
  };
}
