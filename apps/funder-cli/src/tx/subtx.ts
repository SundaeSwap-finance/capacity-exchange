import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { decode, encode, getEncoded } from 'cbor2';
import { readFileSync } from 'node:fs';
import type { Value } from '../cardano/value.js';
import { subValue, sumValues } from '../cardano/value.js';
import {
  asArray,
  asSet,
  BODY_INPUTS,
  BODY_OUTPUTS,
  bytesToHex,
  type CborMap,
  decodeInput,
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
  /**
   * The sub-transaction exactly as its author encoded it. This, not `items`, is what goes into
   * a batch: the author's witnesses sign the hash of these body bytes.
   */
  bytes: Uint8Array;
  body: CborMap;
  /** Hash of the body as encoded, which is also the sub-transaction's TxId and offer id. */
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
 * own body, not the batch's, which is what lets the caller sign an offer before anyone has
 * built the transaction that will carry it.
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

/**
 * The body of the caller's offer: their own UTxO in, and the outputs they want out.
 *
 * It deliberately does not balance. The outputs carry more lovelace than the input — the
 * change output's minimum, which the caller cannot fund — and fewer tokens, the difference
 * being the price. The ledger only checks conservation across the whole batch, so whoever
 * carries the offer makes up the lovelace and keeps the tokens.
 */
export function buildOfferBody(inputs: TxInput[], outputs: TxOutput[]): CborMap {
  return new Map<number, unknown>([
    [BODY_INPUTS, asSet(inputs.map(encodeInput))],
    [BODY_OUTPUTS, outputs.map(encodeOutput)],
  ]);
}

/** Signs a sub-transaction body and returns it in the form that travels in an envelope. */
export function signSubTransaction(body: CborMap, signingKey: Uint8Array): SubTransaction {
  const bodyHash = hashBody(body);
  const publicKey = ed25519.getPublicKey(signingKey);
  const signature = ed25519.sign(bodyHash, signingKey);
  const witnesses = new Map<number, unknown>([[WITS_VKEY, asSet([[publicKey, signature]])]]);
  const items = [body, witnesses, null];
  return {
    items,
    bytes: encode(items),
    body,
    bodyHash: bytesToHex(bodyHash),
    inputs: asArray(body.get(BODY_INPUTS)).map(decodeInput),
    outputs: asArray(body.get(BODY_OUTPUTS)).map(decodeOutput),
  };
}

/**
 * Parses a sub-transaction that arrived as bytes, hashing the body as it was actually encoded
 * rather than as cbor2 would re-encode it. The two agree for anything this tool built; they
 * need not for an offer built elsewhere.
 */
export function decodeSubTransactionBytes(bytes: Uint8Array): SubTransaction {
  const items = decode(bytes, { saveOriginal: true }) as unknown;
  if (!Array.isArray(items) || items.length !== 3) {
    throw new Error('Sub-transaction is not a [body, witnesses, auxiliary_data] array');
  }
  const sub = decodeSubTransaction(items);
  const original = getEncoded(sub.body);
  if (!original) {
    throw new Error('Could not recover the original encoding of the sub-transaction body');
  }
  return { ...sub, bytes, bodyHash: bytesToHex(blake2b(original, { dkLen: 32 })) };
}

/**
 * Parses a sub-transaction already decoded as part of a larger transaction. Its hash is taken
 * over a re-encoding, which is fine for display but not for verifying signatures.
 */
export function decodeSubTransaction(items: unknown[]): SubTransaction {
  const [body, ,] = items;
  if (!(body instanceof Map)) {
    throw new Error('Sub-transaction body is not a CBOR map');
  }
  const map = body as CborMap;
  return {
    items,
    bytes: encode(items),
    body: map,
    bodyHash: bytesToHex(hashBody(map)),
    inputs: asArray(map.get(BODY_INPUTS)).map(decodeInput),
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
 * Checks every vkey witness against the body hash, returning the signing keys. An offer with
 * no witnesses at all is refused: it would be carried on nobody's authority.
 */
export function verifyWitnesses(sub: SubTransaction): string[] {
  const wits = sub.items[1];
  const vkeys = wits instanceof Map ? asArray(wits.get(WITS_VKEY)) : [];
  if (vkeys.length === 0) {
    throw new Error('Sub-transaction carries no vkey witnesses');
  }
  const message = hexToBytes(sub.bodyHash);
  return vkeys.map((w) => {
    const [vkey, signature] = w as Uint8Array[];
    if (!ed25519.verify(signature, message, vkey)) {
      throw new Error(`Witness from ${bytesToHex(vkey).slice(0, 8)}… does not verify against the body hash`);
    }
    return bytesToHex(vkey);
  });
}

/**
 * CIP-0198's imbalance: `consumed − produced`, per asset. A positive entry is what the
 * sub-transaction offers its batch, a negative one what it needs from it. For a babel-fee
 * offer the tokens come out positive and the lovelace negative.
 */
export function imbalance(sub: SubTransaction, resolveInput: (input: TxInput) => Value): Value {
  const consumed = sumValues(sub.inputs.map(resolveInput));
  const produced = sumValues(sub.outputs.map((o) => o.value));
  return subValue(consumed, produced);
}
