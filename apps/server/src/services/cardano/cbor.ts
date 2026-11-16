import {
  BlockId,
  CborReader,
  CborReaderState,
  CborTag,
  CborWriter,
  Slot,
} from '@capacity-exchange/cardano-core';
import { CardanoTip } from './chain-state';
import { Point } from '@cardano-sdk/core';

export interface PersistedCardanoState {
  start: Point;
  recent: CardanoTip[];
  followers: Map<string, Uint8Array>;
}

const STATE_VERSION = 1n;

export function readPersistedCardanoState(reader: CborReader): PersistedCardanoState {
  reader.readStartArray();

  const version = reader.readInt();
  if (version !== STATE_VERSION) {
    throw new Error(`unexpected state version (expected ${STATE_VERSION}, got ${version})`);
  }

  const start = readCardanoPoint(reader);

  const recent: CardanoTip[] = [];
  reader.readStartArray();
  while (reader.peekState() !== CborReaderState.EndArray) {
    recent.push(readCardanoTip(reader));
  }
  reader.readEndArray();

  const followers = new Map<string, Uint8Array>();
  reader.readStartMap();
  while (reader.peekState() !== CborReaderState.EndMap) {
    const key = reader.readTextString();
    const value = reader.readEncodedValue();
    followers.set(key, value);
  }
  reader.readEndMap();

  reader.readEndArray();
  return {
    start,
    recent,
    followers,
  };
}

export function writePersistedCardanoState(writer: CborWriter, value: PersistedCardanoState) {
  writer.writeStartArray();
  writer.writeInt(STATE_VERSION);
  writeCardanoPoint(writer, value.start);
  writer.writeStartArray();
  for (const recent of value.recent) {
    writeCardanoTip(writer, recent);
  }
  writer.writeEndArray();
  writer.writeStartMap();
  for (const [k, v] of value.followers) {
    writer.writeTextString(k);
    writer.writeEncodedValue(v);
  }
  writer.writeEndMap();
  writer.writeEndArray();
}

export function readCardanoPoint(reader: CborReader): Point {
  const readField = <K extends keyof Point>(
    name: K,
    read: (r: CborReader) => Point[K],
  ): Point[K] => {
    if (reader.peekState() === CborReaderState.EndArray) {
      throw new Error(`Missing field ${name}`);
    }
    return read(reader);
  };
  reader.readStartArray();
  const result: Point = {
    slot: readField('slot', (r) => Slot(Number(r.readInt()))),
    hash: readField('hash', (r) => BlockId(Buffer.from(r.readByteString()).toString('hex'))),
  };
  reader.readEndArray();
  return result;
}

export function readCardanoTip(reader: CborReader): CardanoTip {
  const readField = <K extends keyof CardanoTip>(
    name: K,
    read: (r: CborReader) => CardanoTip[K],
  ): CardanoTip[K] => {
    if (reader.peekState() === CborReaderState.EndArray) {
      throw new Error(`Missing field ${name}`);
    }
    return read(reader);
  };
  reader.readStartArray();
  const result: CardanoTip = {
    slot: readField('slot', (r) => r.readInt()),
    hash: readField('hash', (r) => Buffer.from(r.readByteString()).toString('hex')),
    height: readField('height', (r) => r.readInt()),
    timestamp: readField('timestamp', readUnixTime),
  };
  reader.readEndArray();
  return result;
}

export function writeCardanoPoint(writer: CborWriter, value: Point) {
  writer.writeStartArray();
  writer.writeInt(value.slot);
  writer.writeByteString(Buffer.from(value.hash, 'hex'));
  writer.writeEndArray();
}

export function writeCardanoTip(writer: CborWriter, value: CardanoTip) {
  writer.writeStartArray();
  writer.writeInt(value.slot);
  writer.writeByteString(Buffer.from(value.hash, 'hex'));
  writer.writeInt(value.height);
  writeUnixTime(writer, value.timestamp);
  writer.writeEndArray();
}

function readUnixTime(reader: CborReader): Date {
  const tag = reader.readTag();
  if (tag !== CborTag.UnixTimeSeconds) {
    throw new Error(`unexpected tag (expected ${CborTag.UnixTimeSeconds}, actual ${tag})`);
  }
  return new Date(Number(reader.readInt()) * 1000);
}

function writeUnixTime(writer: CborWriter, value: Date) {
  writer.writeTag(CborTag.UnixTimeSeconds);
  writer.writeInt(Math.floor(value.valueOf() / 1000));
}
