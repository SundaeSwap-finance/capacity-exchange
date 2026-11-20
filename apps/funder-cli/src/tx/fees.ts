import type { Cardano } from '@cardano-sdk/core';
import type { Value } from '../cardano/value.js';
import { subValue } from '../cardano/value.js';
import { outputValue, type TxInput, type TxOutput, withValue } from './codec.js';

export type ResolveInput = (input: TxInput) => Value;

/**
 * Deducts the price from the caller's own change output. Matching on the address is the whole
 * point: an output that merely happens to hold enough of the asset may belong to whoever the
 * caller is paying, and billing them instead would be silent theft.
 */
export function deductPrice(
  outputs: TxOutput[],
  price: Map<string, bigint>,
  callerAddress: Cardano.Address
): { outputs: TxOutput[]; index: number } {
  const caller = callerAddress.toBytes();
  const covers = (output: TxOutput): boolean =>
    [...price].every(([unit, qty]) => (outputValue(output).assets.get(unit) ?? 0n) >= qty);
  const index = outputs.findLastIndex((output) => output.address().toBytes() === caller && covers(output));
  if (index < 0) {
    const elsewhere = outputs.some(covers);
    throw new Error(
      elsewhere
        ? 'No output belonging to the caller holds enough of the payment asset. The only output that ' +
            'does belongs to someone else, and paying the exchange out of it would spend their tokens.'
        : 'No output holds enough of the payment asset to cover the price'
    );
  }
  const updated = outputs.map((output, i) =>
    i === index ? withValue(output, subValue(outputValue(output), { lovelace: 0n, assets: price })) : output
  );
  return { outputs: updated, index };
}

/** The exact minimum fee for a script-free transaction of this size. */
export function minFeeFor(sizeBytes: number, txFeeFixed: bigint, txFeePerByte: bigint): bigint {
  return txFeeFixed + BigInt(sizeBytes) * txFeePerByte;
}

/** Bytes vkey witnesses add to an unwitnessed tx: 101 each, plus 5 once for the set wrapper. */
const VKEY_WITNESS_BYTES = 101;
const VKEY_WITNESS_SET_BYTES = 5;

export function vkeyWitnessBytes(witnessCount: number): number {
  return witnessCount === 0 ? 0 : witnessCount * VKEY_WITNESS_BYTES + VKEY_WITNESS_SET_BYTES;
}

/**
 * What an offer pays towards the batch fee: the ledger's fee formula applied to the offer's
 * own size, as CIP-0198 has a wallet do. Whatever the batch costs beyond the sum of these —
 * its own inputs, outputs and witnesses — the exchange carries out of its margin.
 */
export function offerFee(subTxBytes: number, txFeeFixed: bigint, txFeePerByte: bigint): bigint {
  return minFeeFor(subTxBytes, txFeeFixed, txFeePerByte);
}
