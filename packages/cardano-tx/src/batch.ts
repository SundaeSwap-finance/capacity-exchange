import { encode } from 'cbor2';
import type { Value } from './value.js';
import { addValue, lovelaceValue, subValue, sumValues, valuesEqual } from './value.js';
import {
  asArray,
  asSet,
  BODY_FEE,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_REFERENCE_INPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  type DecodedTx,
  decodeInput,
  encodeInput,
  encodeOutput,
  RawCbor,
  readInputs,
  readOutputs,
  type TxInput,
  type TxOutput,
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
  parentInputs: TxInput[],
  parentOutputs: TxOutput[],
  subs: SubTransaction[],
  fee: bigint,
  resolve: ResolveInput
): Balance {
  const consumed = sumValues([...parentInputs.map(resolve), ...subs.flatMap((sub) => sub.inputs.map(resolve))]);
  const produced = addValue(
    sumValues([...parentOutputs.map((o) => o.value), ...subs.flatMap((s) => s.outputs.map((o) => o.value))]),
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
  callerAddress: Uint8Array
): { outputs: TxOutput[]; index: number } {
  const caller = bytesToHex(callerAddress);
  const covers = (output: TxOutput): boolean =>
    [...price].every(([unit, qty]) => (output.value.assets.get(unit) ?? 0n) >= qty);
  const index = outputs.findLastIndex((output) => bytesToHex(output.address) === caller && covers(output));
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
    i === index ? { ...output, value: subValue(output.value, { lovelace: 0n, assets: price }) } : output
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
export function declareSubTransactionInputs(parent: DecodedTx, subs: SubTransaction[]): TxInput[] {
  const existing = asArray(parent.body.get(BODY_REFERENCE_INPUTS)).map(decodeInput);
  const seen = new Set(existing.map((i) => `${i.txHash}#${i.index}`));
  const added: TxInput[] = [];
  for (const input of subs.flatMap((s) => s.inputs)) {
    const ref = `${input.txHash}#${input.index}`;
    if (seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    added.push(input);
  }
  const all = [...existing, ...added];
  // `reference_inputs` is a nonempty_set, so only write the key when there is something in it.
  if (all.length > 0) {
    parent.body.set(BODY_REFERENCE_INPUTS, asSet(all.map(encodeInput)));
  }
  return added;
}

export interface AssembleParams {
  /**
   * The exchange's own draft: its inputs, and a change output that already absorbs the tokens
   * the offers pay and gives up the lovelace they need, all at a fee of zero.
   */
  draft: DecodedTx;
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
  parent: DecodedTx;
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
  const offerIds = subs.map((s) => s.bodyHash);
  if (new Set(offerIds).size !== offerIds.length) {
    throw new Error('The same offer appears twice in one batch');
  }
  const spent = subs.flatMap((s) => s.inputs.map((i) => `${i.txHash}#${i.index}`));
  if (new Set(spent).size !== spent.length) {
    throw new Error('Two offers spend the same input, which the ledger rejects for the whole batch');
  }

  const parent = draft;
  parent.body.set(BODY_SUB_TRANSACTIONS, asSet(subs.map((s) => new RawCbor(s.bytes))));
  const declaredReferenceInputs = declareSubTransactionInputs(parent, subs);

  const { fee, outputs, signedSizeBytes } = settleFee({
    tx: parent,
    changeIndex,
    txFeeFixed,
    txFeePerByte,
    utxoCostPerByte,
    witnessCount,
  });

  const balance = computeBalance(readInputs(parent.body, BODY_INPUTS), outputs, subs, fee, resolve);
  if (!balance.balances) {
    throw new Error('Batch does not balance after assembly; refusing to continue');
  }

  return { parent, fee, balance, signedSizeBytes, declaredReferenceInputs };
}

export interface SettleFeeParams {
  /** A transaction at a fee of zero, whose change output holds everything the fee can come out of. */
  tx: DecodedTx;
  changeIndex: number;
  txFeeFixed: bigint;
  txFeePerByte: bigint;
  utxoCostPerByte: bigint;
  /** Vkey witnesses the transaction will carry, so the fee covers the signed size. */
  witnessCount: number;
}

export interface SettledFee {
  fee: bigint;
  outputs: TxOutput[];
  signedSizeBytes: number;
}

/**
 * Sets the fee and takes it out of the change output, in place. It settles by iteration: the
 * fee changes the change output's size, which can change the fee.
 */
export function settleFee(params: SettleFeeParams): SettledFee {
  const { tx, changeIndex, txFeeFixed, txFeePerByte, utxoCostPerByte, witnessCount } = params;
  const draftOutputs = readOutputs(tx.body, BODY_OUTPUTS);
  const change = draftOutputs[changeIndex];
  if (!change) {
    throw new Error(`Draft has no output #${changeIndex} to take the fee from`);
  }

  let fee = 0n;
  let outputs = draftOutputs;
  let signedSizeBytes = 0;
  for (let pass = 0; pass < 5; pass++) {
    outputs = draftOutputs.map((o, i) =>
      i === changeIndex ? { ...o, value: { ...o.value, lovelace: change.value.lovelace - fee } } : o
    );
    tx.body.set(BODY_OUTPUTS, outputs.map(encodeOutput));
    tx.body.set(BODY_FEE, fee);
    signedSizeBytes = encode(tx.items).length + vkeyWitnessBytes(witnessCount);
    const next = minFeeFor(signedSizeBytes, txFeeFixed, txFeePerByte);
    if (next === fee) {
      break;
    }
    fee = next;
  }
  if (minFeeFor(signedSizeBytes, txFeeFixed, txFeePerByte) !== fee) {
    throw new Error('Fee did not settle; refusing to guess');
  }

  const changeOut = outputs[changeIndex];
  const minChange = minUtxoLovelace(changeOut, utxoCostPerByte);
  if (changeOut.value.lovelace < minChange) {
    throw new Error(
      `Change of ${changeOut.value.lovelace} lovelace is below its ${minChange} lovelace minimum once the ` +
        'fee is paid; the transaction needs larger inputs.'
    );
  }
  return { fee, outputs, signedSizeBytes };
}
