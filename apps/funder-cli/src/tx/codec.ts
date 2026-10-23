import { Cardano, Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Value } from '../cardano/value.js';

export type Transaction = Serialization.Transaction;
export type TransactionBody = Serialization.TransactionBody;
export type SubTransactionBody = Serialization.SubTransactionBody;
export type TxInput = Serialization.TransactionInput;
export type TxOutput = Serialization.TransactionOutput;
export type InputSet = ReturnType<TransactionBody['inputs']>;

export interface TextEnvelope {
  type: string;
  description: string;
  cborHex: string;
}

export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function bytesToHex(bytes: Uint8Array | ArrayBufferView): string {
  return Buffer.from(bytes as Uint8Array).toString('hex');
}

/** Size in bytes of hex-encoded CBOR. */
export function cborSize(hex: string): number {
  return hex.length / 2;
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

export function decodeTx(cborHex: string): Transaction {
  return Serialization.Transaction.fromCbor(Serialization.TxCBOR(cborHex));
}

/**
 * Writes a transaction in Dijkstra's `[body, wits, auxdata]` frame, which is what cardano-cli
 * produces. The SDK's own `toCbor` writes the Alonzo `[body, wits, is_valid, auxdata]` frame
 * whenever it re-encodes, which the ledger accepts but which is a byte longer than what we
 * were given.
 */
export function encodeTx(tx: Transaction): string {
  if (!tx.isValid()) {
    throw new Error('Dijkstra transactions have no is_valid flag; refusing to encode one marked invalid');
  }
  const writer = new Serialization.CborWriter();
  writer.writeStartArray(3);
  writer.writeEncodedValue(hexToBytes(tx.body().toCbor()));
  writer.writeEncodedValue(hexToBytes(tx.witnessSet().toCbor()));
  const auxiliaryData = tx.auxiliaryData();
  if (auxiliaryData) {
    writer.writeEncodedValue(hexToBytes(auxiliaryData.toCbor()));
  } else {
    writer.writeNull();
  }
  return writer.encodeAsHex();
}

/**
 * Guards the one assumption the splice depends on: that re-serialising a transaction body
 * reproduces it byte for byte. The SDK hands back the original bytes until something is set,
 * so this forces a re-encode. If it ever differed, rewriting the body would silently change
 * fields we never meant to touch.
 */
export function assertRoundTrip(cborHex: string): void {
  const tx = decodeTx(cborHex);
  const body = tx.body();
  body.setFee(body.fee());
  tx.setBody(body);
  if (encodeTx(tx) !== cborHex) {
    throw new Error(
      'Transaction CBOR does not survive a decode/encode round trip. Refusing to modify it, ' +
        'because doing so would change the transaction id.'
    );
  }
}

// --- inputs ---

export function makeInput(txHash: string, index: number): TxInput {
  return new Serialization.TransactionInput(Cardano.TransactionId(txHash), BigInt(index));
}

/** `txhash#index`, the same spelling cardano-cli uses for a UTxO. */
export function inputRef(input: TxInput): string {
  return `${input.transactionId()}#${input.index()}`;
}

export function inputSet(inputs: TxInput[]): InputSet {
  const set: InputSet = Serialization.CborSet.fromCore([], Serialization.TransactionInput.fromCore);
  set.setValues(inputs);
  return set;
}

// --- values and outputs ---

/** SDK asset ids are policy id + hex asset name, the same spelling as our units. */
export function fromSdkValue(value: Serialization.Value): Value {
  return { lovelace: value.coin(), assets: new Map(value.multiasset() ?? []) };
}

export function toSdkValue(value: Value): Serialization.Value {
  const assets = value.assets.size > 0 ? new Map(value.assets as Map<Cardano.AssetId, bigint>) : undefined;
  return new Serialization.Value(value.lovelace, assets);
}

export function outputValue(output: TxOutput): Value {
  return fromSdkValue(output.amount());
}

export function makeOutput(address: string | Cardano.Address, value: Value): TxOutput {
  const parsed = typeof address === 'string' ? Cardano.Address.fromBech32(address) : address;
  return new Serialization.TransactionOutput(parsed, toSdkValue(value));
}

/** The same output carrying a different value. Its datum and script ref come along. */
export function withValue(output: TxOutput, value: Value): TxOutput {
  const updated = makeOutput(output.address(), value);
  const datum = output.datum();
  if (datum) {
    updated.setDatum(datum);
  }
  const scriptRef = output.scriptRef();
  if (scriptRef) {
    updated.setScriptRef(scriptRef);
  }
  return updated;
}

/** The payment key hash behind an address, if its payment part is a key and not a script. */
export function paymentKeyHash(address: Cardano.Address): string | undefined {
  const payment = address.getProps().paymentPart;
  return payment?.type === Cardano.CredentialType.KeyHash ? payment.hash : undefined;
}

export function parseSubTransactionBody(cborHex: string): SubTransactionBody {
  return Serialization.SubTransactionBody.fromCbor(HexBlob(cborHex));
}
