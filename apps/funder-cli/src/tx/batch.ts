import { Serialization } from '@cardano-sdk/core';
import type { Cardano } from '@cardano-sdk/core';
import type { Value } from '../cardano/value.js';
import { addValue, lovelaceValue, subValue, sumValues, valuesEqual } from '../cardano/value.js';
import {
  cborSize,
  encodeTx,
  inputRef,
  inputSet,
  outputValue,
  type Transaction,
  type TransactionBody,
  type TxInput,
  type TxOutput,
  withValue,
} from './codec.js';
import { minUtxoLovelace, type SubTransaction } from './subtx.js';

export interface Balance {
  consumed: Value;
  produced: Value;
  fee: bigint;
  balances: boolean;
}

export type ResolveInput = (input: TxInput) => Value;

/**
 * Value conservation for a whole batch. Dijkstra checks this only at the top level, summing
 * the parent and every sub-transaction together, so a sub-transaction that does not balance
 * on its own is perfectly valid as long as the batch does.
 */
export function computeBalance(
  parentInputs: readonly TxInput[],
  parentOutputs: readonly TxOutput[],
  subs: SubTransaction[],
  fee: bigint,
  resolve: ResolveInput
): Balance {
  const subBodies = subs.map((sub) => sub.body());
  const consumed = sumValues([
    ...parentInputs.map(resolve),
    ...subBodies.flatMap((body) => body.inputs().values().map(resolve)),
  ]);
  const produced = addValue(
    sumValues([...parentOutputs, ...subBodies.flatMap((body) => body.outputs())].map(outputValue)),
    lovelaceValue(fee)
  );
  return { consumed, produced, fee, balances: valuesEqual(consumed, produced) };
}

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

/**
 * Copies every sub-transaction input into the parent's reference inputs.
 *
 * The node resolves the UTxOs it validates against from the top-level body's `allInputs`,
 * which in Dijkstra is still Babbage's spend + reference + collateral and does not look inside
 * `sub_transactions`. A sub-transaction input that appears nowhere at the top level is
 * therefore never fetched, and the sub-ledger rules reject it as `SubBadInputsUTxO` even
 * though it is present and unspent on chain.
 *
 * Listing them as reference inputs puts them in `allInputs`, so they get resolved, without the
 * parent also consuming them -- which is what happens if they are added as spend inputs, since
 * sub-transactions are processed first and the parent then double-spends.
 */
export function declareSubTransactionInputs(body: TransactionBody, subs: SubTransaction[]): TxInput[] {
  const existing = body.referenceInputs()?.values() ?? [];
  const seen = new Set(existing.map(inputRef));
  const added: TxInput[] = [];
  for (const input of subs.flatMap((s) => s.body().inputs().values())) {
    const ref = inputRef(input);
    if (seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    added.push(input);
  }
  const all = [...existing, ...added];
  // `reference_inputs` is a nonempty_set, so only write the key when there is something in it.
  if (all.length > 0) {
    body.setReferenceInputs(inputSet(all));
  }
  return added;
}

export interface AssembleParams {
  /**
   * The exchange's own draft: its inputs, and a change output that already absorbs the tokens
   * the offers pay and gives up the lovelace they need, all at a fee of zero.
   */
  draft: Transaction;
  /** Which draft output is the exchange's change, so the fee can come out of it. */
  changeIndex: number;
  subs: SubTransaction[];
  resolve: ResolveInput;
  txFeeFixed: bigint;
  txFeePerByte: bigint;
  utxoCostPerByte: bigint;
  /** Vkey witnesses the parent will carry, so the fee covers the signed size. */
  witnessCount: number;
}

export interface AssembleResult {
  parent: Transaction;
  fee: bigint;
  balance: Balance;
  signedSizeBytes: number;
  declaredReferenceInputs: TxInput[];
}

/**
 * Turns the exchange's draft into a batch carrying the offers.
 *
 * The offers go in verbatim, as CIP-0198 requires, because their witnesses sign their bodies
 * as encoded. The fee is then settled by iteration: it comes out of the change output, which
 * can change that output's size, which can change the fee.
 */
export function assembleBatch(params: AssembleParams): AssembleResult {
  const { draft, changeIndex, subs, resolve, txFeeFixed, txFeePerByte, utxoCostPerByte, witnessCount } = params;
  if (subs.length === 0) {
    throw new Error('A batch needs at least one offer');
  }
  const offerIds = subs.map((s) => s.getId());
  if (new Set(offerIds).size !== offerIds.length) {
    throw new Error('The same offer appears twice in one batch');
  }
  const spent = subs.flatMap((s) => s.body().inputs().values().map(inputRef));
  if (new Set(spent).size !== spent.length) {
    throw new Error('Two offers spend the same input, which the ledger rejects for the whole batch');
  }

  const body = draft.body();
  // Each sub-transaction keeps the bytes it was parsed from, so this writes them verbatim.
  const subTransactions = Serialization.CborSet.fromCore([], Serialization.SubTransaction.fromCore);
  subTransactions.setValues(subs);
  body.setSubTransactions(subTransactions);
  const declaredReferenceInputs = declareSubTransactionInputs(body, subs);

  const parent = new Serialization.Transaction(body, draft.witnessSet(), draft.auxiliaryData());
  const parentInputs = body.inputs().values();
  const draftOutputs = body.outputs();
  const change = draftOutputs[changeIndex];
  if (!change) {
    throw new Error(`Draft has no output #${changeIndex} to take the fee from`);
  }
  const changeValue = outputValue(change);

  let fee = 0n;
  let outputs = draftOutputs;
  let signedSizeBytes = 0;
  for (let pass = 0; pass < 5; pass++) {
    outputs = draftOutputs.map((o, i) =>
      i === changeIndex ? withValue(o, { ...changeValue, lovelace: changeValue.lovelace - fee }) : o
    );
    body.setOutputs(outputs);
    body.setFee(fee);
    parent.setBody(body);
    signedSizeBytes = cborSize(encodeTx(parent)) + vkeyWitnessBytes(witnessCount);
    const next = minFeeFor(signedSizeBytes, txFeeFixed, txFeePerByte);
    if (next === fee) {
      break;
    }
    fee = next;
  }
  if (minFeeFor(signedSizeBytes, txFeeFixed, txFeePerByte) !== fee) {
    throw new Error('Batch fee did not settle; refusing to guess');
  }

  const changeOut = outputs[changeIndex];
  const changeLovelace = outputValue(changeOut).lovelace;
  const minChange = minUtxoLovelace(changeOut, utxoCostPerByte);
  if (changeLovelace < minChange) {
    throw new Error(
      `Exchange change of ${changeLovelace} lovelace is below its ${minChange} lovelace minimum ` +
        'once the offers and the fee are paid for; it needs a larger UTxO to fund this batch.'
    );
  }

  const balance = computeBalance(parentInputs, outputs, subs, fee, resolve);
  if (!balance.balances) {
    throw new Error('Batch does not balance after assembly; refusing to continue');
  }

  return { parent, fee, balance, signedSizeBytes, declaredReferenceInputs };
}
