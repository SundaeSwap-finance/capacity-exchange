import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { decode, encode } from 'cbor2';
import { readFileSync } from 'node:fs';
import type { Value } from '../cardano/value.js';
import { emptyValue, subValue, sumValues } from '../cardano/value.js';
import {
  asArray,
  asSet,
  BODY_INPUTS,
  BODY_OUTPUTS,
  bytesToHex,
  type CborMap,
  decodeOutput,
  encodeInput,
  encodeOutput,
  hexToBytes,
  type TxInput,
  type TxOutput,
} from './codec.js';

/** Witness set keys. Only vkey witnesses are used here. */
const WITS_VKEY = 0;

/** The ledger's min-UTxO formula for Babbage onwards: (160 + |output|) * coinsPerUTxOByte. */
const MIN_UTXO_OVERHEAD = 160n;

export interface SubTransaction {
  /** `[sub_transaction_body, witness_set, auxiliary_data/nil]`. */
  items: unknown[];
  body: CborMap;
  bodyHash: string;
  inputs: TxInput[];
  outputs: TxOutput[];
}

/** Reads a cardano-cli PaymentSigningKeyShelley_ed25519 file down to its 32-byte seed. */
export function readSigningKey(path: string): Uint8Array {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as { type: string; cborHex: string };
  if (!envelope.cborHex) {
    throw new Error(`${path} is not a cardano-cli signing key file`);
  }
  if (envelope.type?.includes('Extended')) {
    throw new Error(`${path} is an extended key; this tool only supports plain ed25519 payment keys`);
  }
  const seed = decode(hexToBytes(envelope.cborHex)) as Uint8Array;
  if (seed.length !== 32) {
    throw new Error(`Expected a 32-byte signing key, got ${seed.length} bytes`);
  }
  return seed;
}

/**
 * The hash a witness signs. For a sub-transaction this is the hash of the *sub*-transaction's
 * own body, not the parent's, which is what lets the exchange sign an offer without knowing
 * the transaction that will eventually carry it.
 */
export function hashBody(body: CborMap): Uint8Array {
  return blake2b(encode(body), { dkLen: 32 });
}

/** Minimum lovelace an output must carry, given how large it serialises. */
export function minUtxoLovelace(output: TxOutput, utxoCostPerByte: bigint): bigint {
  // The amount feeds back into the size, so settle it in two passes.
  let candidate = output;
  let result = 0n;
  for (let pass = 0; pass < 2; pass++) {
    const size = BigInt(encode(encodeOutput(candidate)).length);
    result = (MIN_UTXO_OVERHEAD + size) * utxoCostPerByte;
    candidate = { ...output, value: { ...output.value, lovelace: result } };
  }
  return result;
}

export interface BuildSubTxParams {
  /** The exchange's own UTxO, funding the release. */
  input: TxInput;
  inputValue: Value;
  /** Where the exchange wants its payment and change sent. */
  address: Uint8Array;
  /** What the caller pays, as unit -> quantity. */
  price: Map<string, bigint>;
  /** Lovelace this sub-transaction releases into the bundle to cover the parent's fee. */
  released: bigint;
  utxoCostPerByte: bigint;
  signingKey: Uint8Array;
}

/**
 * Builds and signs the partial transaction an exchange hands back for an offer.
 *
 * It spends one of the exchange's ADA UTxOs and produces two outputs back to the exchange:
 * the payment (the caller's tokens, which come from the parent transaction's value pool) and
 * the ADA change. It deliberately does not balance on its own — the shortfall is exactly the
 * lovelace it releases, and the ledger only checks conservation across the whole bundle.
 */
export function buildSubTransaction(params: BuildSubTxParams): SubTransaction {
  const { input, inputValue, address, price, released, utxoCostPerByte, signingKey } = params;

  const paymentValue: Value = { lovelace: 0n, assets: new Map(price) };
  const paymentOutput: TxOutput = { address, value: paymentValue };
  paymentValue.lovelace = minUtxoLovelace(paymentOutput, utxoCostPerByte);

  const changeLovelace = inputValue.lovelace - paymentValue.lovelace - released;
  const changeOutput: TxOutput = { address, value: { lovelace: changeLovelace, assets: new Map() } };
  const minChange = minUtxoLovelace(changeOutput, utxoCostPerByte);
  if (changeLovelace < minChange) {
    throw new Error(
      `Exchange UTxO of ${inputValue.lovelace} lovelace is too small: after a ${paymentValue.lovelace} ` +
        `lovelace payment output and releasing ${released}, the ${changeLovelace} lovelace change is ` +
        `below the ${minChange} lovelace minimum.`
    );
  }

  const body: CborMap = new Map<number, unknown>([
    [BODY_INPUTS, asSet([encodeInput(input)])],
    [BODY_OUTPUTS, [encodeOutput(paymentOutput), encodeOutput(changeOutput)]],
  ]);

  const bodyHash = hashBody(body);
  const publicKey = ed25519.getPublicKey(signingKey);
  const signature = ed25519.sign(bodyHash, signingKey);
  const witnesses = new Map<number, unknown>([[WITS_VKEY, asSet([[publicKey, signature]])]]);

  const items = [body, witnesses, null];

  return {
    items,
    body,
    bodyHash: bytesToHex(bodyHash),
    inputs: [input],
    outputs: [paymentOutput, changeOutput],
  };
}

/** Parses a sub-transaction that arrived from an exchange. */
export function decodeSubTransaction(items: unknown[]): SubTransaction {
  const [body, ,] = items;
  if (!(body instanceof Map)) {
    throw new Error('Sub-transaction body is not a CBOR map');
  }
  const map = body as CborMap;
  return {
    items,
    body: map,
    bodyHash: bytesToHex(hashBody(map)),
    inputs: asArray(map.get(BODY_INPUTS)).map((raw) => {
      const [hash, index] = raw as [Uint8Array, number];
      return { txHash: bytesToHex(hash), index: Number(index) };
    }),
    outputs: asArray(map.get(BODY_OUTPUTS)).map(decodeOutput),
  };
}

/** The vkeys that signed a sub-transaction, for display. */
export function subTransactionSigners(items: unknown[]): string[] {
  const wits = items[1];
  if (!(wits instanceof Map)) {
    return [];
  }
  return asArray(wits.get(WITS_VKEY)).map((w) => bytesToHex((w as Uint8Array[])[0]));
}

/**
 * Lovelace a sub-transaction contributes to the bundle: what it spends, less what it
 * re-creates. This is the number that ends up covering the parent's fee.
 */
export function releasedLovelace(sub: SubTransaction, resolveInput: (input: TxInput) => Value): bigint {
  const consumed = sumValues(sub.inputs.map(resolveInput));
  const produced = sumValues(sub.outputs.map((o) => o.value));
  return subValue(consumed, produced).lovelace;
}

/** Tokens a sub-transaction takes out of the bundle, i.e. what the caller is paying. */
export function tokensTaken(sub: SubTransaction, resolveInput: (input: TxInput) => Value): Value {
  const consumed = sumValues(sub.inputs.map(resolveInput));
  const produced = sumValues(sub.outputs.map((o) => o.value));
  const delta = subValue(produced, consumed);
  const taken = emptyValue();
  for (const [unit, quantity] of delta.assets) {
    if (quantity > 0n) {
      taken.assets.set(unit, quantity);
    }
  }
  return taken;
}
