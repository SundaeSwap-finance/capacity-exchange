import { decode, encode, Tag } from 'cbor2';
import { readFileSync, writeFileSync } from 'node:fs';
import { emptyValue, type Value } from '../cardano/value.js';

/** Transaction body map keys we touch. See eras/dijkstra/impl/cddl/data/dijkstra.cddl. */
export const BODY_INPUTS = 0;
export const BODY_OUTPUTS = 1;
export const BODY_FEE = 2;
export const BODY_MINT = 9;
export const BODY_REFERENCE_INPUTS = 18;
export const BODY_SUB_TRANSACTIONS = 23;

/** Body keys a funding sub-transaction has no business using. */
export const FORBIDDEN_SUB_TX_KEYS: Array<[number, string]> = [
  [4, 'certificates'],
  [5, 'withdrawals'],
  [9, 'mint'],
  [19, 'voting procedures'],
  [20, 'proposal procedures'],
];

export type CborMap = Map<number, unknown>;

/** CBOR integers decode as `number` when small and `bigint` when large; normalise to bigint. */
export function toBigInt(value: unknown, fallback = 0n): bigint {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  throw new Error(`Expected a CBOR integer, got ${typeof value}`);
}

export interface TextEnvelope {
  type: string;
  description: string;
  cborHex: string;
}

/**
 * A decoded transaction. Dijkstra's mempool form is `[body, wits, auxdata]`, but a
 * `[body, wits, true, auxdata]` form is also accepted by the ledger, so we keep the raw
 * item list and its arity rather than assuming either.
 */
export interface DecodedTx {
  items: unknown[];
  body: CborMap;
}

export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function bytesToHex(bytes: Uint8Array | ArrayBufferView): string {
  return Buffer.from(bytes as Uint8Array).toString('hex');
}

export function readEnvelope(path: string): TextEnvelope {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as TextEnvelope;
  if (!parsed.cborHex) {
    throw new Error(`${path} is not a cardano-cli TextEnvelope (no cborHex)`);
  }
  return parsed;
}

export function writeEnvelope(path: string, envelope: TextEnvelope): void {
  writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`);
}

export function decodeTx(cborHex: string): DecodedTx {
  const items = decode(hexToBytes(cborHex)) as unknown[];
  if (!Array.isArray(items) || items.length < 3) {
    throw new Error('Transaction CBOR is not a [body, witnesses, ...] array');
  }
  const body = items[0];
  if (!(body instanceof Map)) {
    throw new Error('Transaction body is not a CBOR map');
  }
  return { items, body: body as CborMap };
}

export function encodeTx(tx: DecodedTx): string {
  return bytesToHex(encode(tx.items));
}

/**
 * Guards the one assumption the splice depends on: that decoding and re-encoding a
 * transaction reproduces it byte for byte. If it ever did not, rewriting the body would
 * silently change the transaction id and invalidate every signature already on it.
 */
export function assertRoundTrip(cborHex: string): void {
  const reencoded = encodeTx(decodeTx(cborHex));
  if (reencoded !== cborHex) {
    throw new Error(
      'Transaction CBOR does not survive a decode/encode round trip. Refusing to modify it, ' +
        'because doing so would change the transaction id.'
    );
  }
}

// --- sets ---

/** Tag 258 decodes to a JS Set; a plain array is also valid CDDL. Normalise both to an array. */
export function asArray(value: unknown): unknown[] {
  if (value instanceof Set) {
    return [...value];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (value instanceof Tag) {
    return asArray(value.contents);
  }
  return value === undefined || value === null ? [] : [value];
}

/** Encodes a list as a CBOR set (tag 258), which is what the ledger expects for inputs. */
export function asSet(values: unknown[]): Tag {
  return new Tag(258, values);
}

// --- inputs ---

export interface TxInput {
  txHash: string;
  index: number;
}

export function decodeInput(raw: unknown): TxInput {
  const [hash, index] = raw as [Uint8Array, number];
  return { txHash: bytesToHex(hash), index: Number(index) };
}

export function encodeInput(input: TxInput): unknown {
  return [hexToBytes(input.txHash), input.index];
}

export function readInputs(body: CborMap, key: number): TxInput[] {
  return asArray(body.get(key)).map(decodeInput);
}

// --- outputs ---

export interface TxOutput {
  /** Raw address bytes, kept as-is so we never re-encode bech32 we did not parse. */
  address: Uint8Array;
  value: Value;
  /**
   * Anything beyond address+value (datum, script ref) is preserved verbatim: the trailing
   * items of an array output, or the whole map of a Babbage map output.
   */
  rest?: unknown;
}

function decodeValue(raw: unknown): Value {
  const value = emptyValue();
  if (typeof raw === 'bigint' || typeof raw === 'number') {
    value.lovelace = BigInt(raw);
    return value;
  }
  const [coin, multiasset] = raw as [bigint | number, Map<Uint8Array, Map<Uint8Array, bigint>>];
  value.lovelace = BigInt(coin);
  for (const [policy, assets] of multiasset) {
    for (const [name, quantity] of assets) {
      value.assets.set(`${bytesToHex(policy)}${bytesToHex(name)}`, BigInt(quantity));
    }
  }
  return value;
}

function encodeValue(value: Value): unknown {
  if (value.assets.size === 0) {
    return value.lovelace;
  }
  const multiasset = new Map<Uint8Array, Map<Uint8Array, bigint>>();
  // Group by policy id, preserving the caller's asset ordering within each policy.
  for (const [unit, quantity] of value.assets) {
    const policyHex = unit.slice(0, 56);
    const nameHex = unit.slice(56);
    let existing: Map<Uint8Array, bigint> | undefined;
    for (const [policy, assets] of multiasset) {
      if (bytesToHex(policy) === policyHex) {
        existing = assets;
        break;
      }
    }
    if (!existing) {
      existing = new Map();
      multiasset.set(hexToBytes(policyHex), existing);
    }
    existing.set(hexToBytes(nameHex), quantity);
  }
  return [value.lovelace, multiasset];
}

export function decodeOutput(raw: unknown): TxOutput {
  if (raw instanceof Map) {
    // Babbage-style map output.
    const map = raw as Map<number, unknown>;
    return { address: map.get(0) as Uint8Array, value: decodeValue(map.get(1)), rest: raw };
  }
  const [address, value, ...rest] = raw as unknown[];
  return { address: address as Uint8Array, value: decodeValue(value), rest: rest.length ? rest : undefined };
}

/**
 * Re-emits an output in the form it was decoded from: a map output keeps its map (so its
 * datum, script ref and key ordering survive), and anything else becomes the Alonzo-style
 * array, which is what cardano-cli produces for simple outputs.
 */
export function encodeOutput(output: TxOutput): unknown {
  if (output.rest instanceof Map) {
    // Copying preserves key order, and re-setting 0 and 1 keeps them in their original slots.
    const map = new Map(output.rest as Map<number, unknown>);
    map.set(0, output.address);
    map.set(1, encodeValue(output.value));
    return map;
  }
  const base = [output.address, encodeValue(output.value)];
  return Array.isArray(output.rest) ? [...base, ...output.rest] : base;
}

export function readOutputs(body: CborMap, key: number): TxOutput[] {
  return asArray(body.get(key)).map(decodeOutput);
}
