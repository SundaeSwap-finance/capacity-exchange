import { BlockId, BlockNo, PartialBlockHeader, Slot, Transaction } from './types.js';
import { Serialization } from '@cardano-sdk/core';
import { blake2b } from '@cardano-sdk/crypto';
import { HexBlob } from '@cardano-sdk/util';
const { CborReader, CborReaderState } = Serialization;
type CborReader = Serialization.CborReader;

// Eras 0 and 1 are Byron, whose blocks have a different layout.
const FIRST_SHELLEY_ERA = 2n;
// From Dijkstra a block is [header, block_body] rather than a flat array.
const DIJKSTRA_BLOCK_LENGTH = 2;

/** A transaction's parts as encoded in the block. */
interface BlockTransaction {
  body: Uint8Array;
  witnessSet: Uint8Array;
  auxiliaryData?: Uint8Array;
  isValid: boolean;
}

/**
 * Splits a Shelley-or-later block into its header and transactions. Takes the
 * block bare or wrapped with its era as `[era, block]`.
 */
export function parseBlock(cbor: Uint8Array): [PartialBlockHeader, Transaction[]] {
  const reader = new CborReader(HexBlob.fromBytes(cbor));
  let length = reader.readStartArray();
  const wrapped = length === 2 && reader.peekState() === CborReaderState.UnsignedInteger;
  if (wrapped) {
    const era = reader.readUInt();
    if (era < FIRST_SHELLEY_ERA) {
      throw new Error(`unsupported Byron block (era ${era})`);
    }
    length = reader.readStartArray();
  }
  if (length === null) {
    throw new Error('expected a definite-length block');
  }

  // The block hash covers the header as encoded.
  const headerBytes = reader.readEncodedValue();
  const txs = length === DIJKSTRA_BLOCK_LENGTH ? readDijkstraBody(reader) : readPreDijkstraBody(reader);
  reader.readEndArray();
  if (wrapped) {
    reader.readEndArray();
  }
  if (reader.getBytesRemaining()) {
    throw new Error('unexpected trailing data');
  }

  const header = {
    ...readHeader(headerBytes),
    hash: BlockId(blake2b.hash(HexBlob.fromBytes(headerBytes), 32)),
  };
  return [header, txs.map(toTransaction)];
}

// header = [header_body, body_signature]; every era's header_body starts with
// the block number and slot.
function readHeader(headerBytes: Uint8Array): Omit<PartialBlockHeader, 'hash'> {
  const reader = new CborReader(HexBlob.fromBytes(headerBytes));
  reader.readStartArray();
  reader.readStartArray();
  return {
    blockNo: BlockNo(Number(reader.readUInt())),
    slot: Slot(Number(reader.readUInt())),
  };
}

// block_body = [[* [body, witness_set, auxiliary_data / nil, is_valid]], leios_cert / nil, peras_cert / nil]
function readDijkstraBody(reader: CborReader): BlockTransaction[] {
  reader.readStartArray();
  const txs = readArray(reader, () => {
    reader.readStartArray();
    const body = reader.readEncodedValue();
    const witnessSet = reader.readEncodedValue();
    let auxiliaryData: Uint8Array | undefined;
    if (reader.peekState() === CborReaderState.Null) {
      reader.readNull();
    } else {
      auxiliaryData = reader.readEncodedValue();
    }
    const isValid = reader.readBoolean();
    reader.readEndArray();
    return { body, witnessSet, auxiliaryData, isValid };
  });
  // The Leios and Peras certificates.
  reader.readEncodedValue();
  reader.readEncodedValue();
  reader.readEndArray();
  return txs;
}

// The rest of [header, bodies, witness_sets, auxiliary_data, invalid_txs?].
function readPreDijkstraBody(reader: CborReader): BlockTransaction[] {
  const bodies = readArray(reader, () => reader.readEncodedValue());
  const witnessSets = readArray(reader, () => reader.readEncodedValue());
  if (bodies.length !== witnessSets.length) {
    throw new Error(`block has ${bodies.length} tx bodies but ${witnessSets.length} witness sets`);
  }

  const auxiliaryData = new Map<number, Uint8Array>();
  reader.readStartMap();
  while (reader.peekState() !== CborReaderState.EndMap) {
    const index = Number(reader.readUInt());
    auxiliaryData.set(index, reader.readEncodedValue());
  }
  reader.readEndMap();

  // Pre-Alonzo blocks have no invalid list; every transaction in them is valid.
  const invalid = new Set(
    reader.peekState() === CborReaderState.EndArray ? [] : readArray(reader, () => Number(reader.readUInt()))
  );

  return bodies.map((body, i) => ({
    body,
    witnessSet: witnessSets[i],
    auxiliaryData: auxiliaryData.get(i),
    isValid: !invalid.has(i),
  }));
}

const TX_ARRAY_HEADER = Uint8Array.of(0x84);
const CBOR_FALSE = Uint8Array.of(0xf4);
const CBOR_TRUE = Uint8Array.of(0xf5);
const CBOR_NULL = Uint8Array.of(0xf6);

// Reassembled as [body, witness_set, is_valid, auxiliary_data / nil], the order
// Transaction.fromCbor reads. The parts keep the block's bytes, so the body
// still hashes to the transaction id.
function toTransaction(tx: BlockTransaction): Transaction {
  const cbor = Buffer.concat([
    TX_ARRAY_HEADER,
    tx.body,
    tx.witnessSet,
    tx.isValid ? CBOR_TRUE : CBOR_FALSE,
    tx.auxiliaryData ?? CBOR_NULL,
  ]);
  return Transaction.fromCbor(Serialization.TxCBOR(HexBlob.fromBytes(cbor)));
}

// Handles both definite and indefinite-length arrays.
function readArray<T>(reader: CborReader, readItem: () => T): T[] {
  const items: T[] = [];
  reader.readStartArray();
  while (reader.peekState() !== CborReaderState.EndArray) {
    items.push(readItem());
  }
  reader.readEndArray();
  return items;
}
