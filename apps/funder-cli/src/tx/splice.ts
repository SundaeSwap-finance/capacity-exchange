import { encode } from 'cbor2';
import type { Value } from '../cardano/value.js';
import { addValue, emptyValue, lovelaceValue, subValue, sumValues, valuesEqual } from '../cardano/value.js';
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
  FORBIDDEN_SUB_TX_KEYS,
  readInputs,
  readOutputs,
  type TxInput,
  type TxOutput,
} from './codec.js';
import { releasedLovelace, type SubTransaction, tokensTaken } from './subtx.js';

export interface Balance {
  consumed: Value;
  produced: Value;
  fee: bigint;
  balances: boolean;
}

export type ResolveInput = (input: TxInput) => Value;

/**
 * Value conservation for a whole bundle. Dijkstra checks this only at the top level, summing
 * the parent and every sub-transaction together, so a sub-transaction that does not balance
 * on its own is perfectly valid as long as the bundle does.
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

export interface VerifyResult {
  released: bigint;
  taken: Value;
}

/**
 * Checks an offer before it is spliced in. The caller is trusting the exchange with exactly
 * one thing — the price — so that is what is checked hardest; the structural checks exist to
 * make sure a funding offer is only ever moving value.
 */
export function verifyOffer(
  sub: SubTransaction,
  expectedPrice: Map<string, bigint>,
  callerInputs: TxInput[],
  resolve: ResolveInput
): VerifyResult {
  for (const [key, label] of FORBIDDEN_SUB_TX_KEYS) {
    if (sub.body.has(key)) {
      throw new Error(`Offer rejected: sub-transaction contains ${label}, which a funding offer must not do`);
    }
  }

  const callerRefs = new Set(callerInputs.map((i) => `${i.txHash}#${i.index}`));
  for (const input of sub.inputs) {
    if (callerRefs.has(`${input.txHash}#${input.index}`)) {
      throw new Error(`Offer rejected: sub-transaction spends the caller's own UTxO ${input.txHash}#${input.index}`);
    }
  }

  const taken = tokensTaken(sub, resolve);
  const expected: Value = { lovelace: 0n, assets: expectedPrice };
  if (!valuesEqual(taken, expected)) {
    throw new Error(
      `Offer rejected: sub-transaction takes ${formatAssets(taken)} but the quoted price was ` +
        `${formatAssets(expected)}`
    );
  }

  const released = releasedLovelace(sub, resolve);
  if (released <= 0n) {
    throw new Error(`Offer rejected: sub-transaction releases no lovelace (net ${released})`);
  }

  return { released, taken };
}

function formatAssets(value: Value): string {
  if (value.assets.size === 0) {
    return 'nothing';
  }
  return [...value.assets].map(([unit, qty]) => `${qty} ${unit.slice(0, 12)}…`).join(', ');
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
        : 'No parent output holds enough of the payment asset to cover the price'
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

export interface SpliceParams {
  parent: DecodedTx;
  sub: SubTransaction;
  price: Map<string, bigint>;
  resolve: ResolveInput;
  txFeeFixed: bigint;
  txFeePerByte: bigint;
  /** Bytes each expected vkey witness adds, so the fee covers the signed size. */
  witnessCount: number;
  /** Raw address bytes of the caller, so the price comes out of their change and no one else's. */
  callerAddress: Uint8Array;
}

export interface SpliceResult {
  parent: DecodedTx;
  fee: bigint;
  minFee: bigint;
  surplus: bigint;
  released: bigint;
  taken: Value;
  balance: Balance;
  paymentOutputIndex: number;
  signedSizeBytes: number;
  declaredReferenceInputs: TxInput[];
}

/** Bytes vkey witnesses add to an unwitnessed tx: 101 each, plus 5 once for the set wrapper. */
const VKEY_WITNESS_BYTES = 101;
const VKEY_WITNESS_SET_BYTES = 5;

export function vkeyWitnessBytes(witnessCount: number): number {
  return witnessCount === 0 ? 0 : witnessCount * VKEY_WITNESS_BYTES + VKEY_WITNESS_SET_BYTES;
}

export function spliceOffer(params: SpliceParams): SpliceResult {
  const { parent, sub, price, resolve, txFeeFixed, txFeePerByte, witnessCount, callerAddress } = params;

  const parentInputs = readInputs(parent.body, BODY_INPUTS);
  const { released, taken } = verifyOffer(sub, price, parentInputs, resolve);

  const { outputs, index } = deductPrice(readOutputs(parent.body, BODY_OUTPUTS), price, callerAddress);
  parent.body.set(BODY_OUTPUTS, outputs.map(encodeOutput));
  parent.body.set(BODY_SUB_TRANSACTIONS, asSet([sub.items]));
  const declaredReferenceInputs = declareSubTransactionInputs(parent, [sub]);

  // The fee is simply whatever makes the bundle balance; with the caller contributing no
  // lovelace of their own, it is the amount the sub-transaction released.
  const withoutFee = computeBalance(parentInputs, outputs, [sub], 0n, resolve);
  const fee = subValue(withoutFee.consumed, withoutFee.produced).lovelace;
  parent.body.set(BODY_FEE, fee);

  const balance = computeBalance(parentInputs, outputs, [sub], fee, resolve);
  if (!balance.balances) {
    throw new Error('Bundle does not balance after splicing; refusing to continue');
  }

  const signedSizeBytes = encode(parent.items).length + vkeyWitnessBytes(witnessCount);
  const minFee = minFeeFor(signedSizeBytes, txFeeFixed, txFeePerByte);
  if (fee < minFee) {
    throw new Error(
      `Fee of ${fee} lovelace is below the ${minFee} lovelace minimum for a ${signedSizeBytes} byte ` +
        'transaction. The exchange did not pad its estimate enough.'
    );
  }

  return {
    parent,
    fee,
    minFee,
    surplus: fee - minFee,
    released,
    taken,
    balance,
    paymentOutputIndex: index,
    signedSizeBytes,
    declaredReferenceInputs,
  };
}

export { emptyValue };
