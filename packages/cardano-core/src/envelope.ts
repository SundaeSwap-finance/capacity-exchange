import { SubTransaction } from './types';
import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
const { CborReader, CborTag } = Serialization;

export const ENVELOPE_VERSION_TAG = 1n;
export const DIJKSTRA_ERA_TAG = 7n;

export type ParseEnvelopeResult =
  { status: 'ok'; value: SubTransaction } | { status: 'malformed'; reason: string } | { status: 'unsupported-version' };

export function parseEnvelope(envelope: Uint8Array): ParseEnvelopeResult {
  try {
    return doParseEnvelope(envelope);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: 'malformed', reason };
  }
}

function doParseEnvelope(envelope: Uint8Array): ParseEnvelopeResult {
  const reader = new CborReader(HexBlob.fromBytes(envelope));
  const length = reader.readStartArray();
  if (length !== null && length !== 3) {
    return { status: 'malformed', reason: 'expected array of length 3' };
  }

  const version = reader.readUInt();
  if (version !== ENVELOPE_VERSION_TAG) {
    return { status: 'unsupported-version' };
  }

  // we don't actually need the era tag, but let's still validate it
  const eraTag = reader.readUInt();
  if (eraTag != DIJKSTRA_ERA_TAG) {
    return { status: 'unsupported-version' };
  }

  const tag = reader.readTag();
  if (tag !== CborTag.EncodedCborDataItem) {
    throw new Error(`expected tag ${CborTag.EncodedCborDataItem}, found ${tag}`);
  }

  const subTxBytes = reader.readByteString();
  const subTx = SubTransaction.fromCbor(HexBlob.fromBytes(subTxBytes));

  reader.readEndArray();
  if (reader.getBytesRemaining()) {
    throw new Error('unexpected trailing data');
  }

  return { status: 'ok', value: subTx };
}
