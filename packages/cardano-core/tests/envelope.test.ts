import { describe, it, expect } from 'vitest';
import { DIJKSTRA_ERA_TAG, ENVELOPE_VERSION_TAG, parseEnvelope, serializeEnvelope, SubTransaction } from '../src';
import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';

describe('parseEnvelope', () => {
  function emptySubTxBytes(): Uint8Array {
    const subTx = SubTransaction.fromCore({
      body: {
        inputs: [],
        outputs: [],
      },
      witness: {
        signatures: new Map(),
      },
    });
    return Buffer.from(subTx.toCbor(), 'hex');
  }

  interface EnvelopeOptions {
    length?: number;
    version?: bigint;
    eraTag?: bigint;
    tag?: number | null;
    subTxBytes?: Uint8Array;
  }

  function writeEnvelope(options: EnvelopeOptions = {}): Uint8Array {
    const writer = new Serialization.CborWriter();
    writer.writeStartArray(options.length ?? 3);
    writer.writeInt(options.version ?? ENVELOPE_VERSION_TAG);
    writer.writeInt(options.eraTag ?? DIJKSTRA_ERA_TAG);
    const tag = options.tag === undefined ? Serialization.CborTag.EncodedCborDataItem : options.tag;
    if (tag !== null) {
      writer.writeTag(tag);
    }
    if (options.subTxBytes) {
      writer.writeByteString(options.subTxBytes);
    }
    return writer.encode();
  }

  it('should parse an envelope for a valid subtx', () => {
    const envelope = writeEnvelope({ subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toMatchObject({
      status: 'ok',
    });
  });

  it('should reject an empty buffer', () => {
    // CborReader throws when there's nothing to read
    const parseResult = parseEnvelope(new Uint8Array());
    expect(parseResult).toMatchObject({ status: 'malformed' });
  });

  it('should reject a truncated envelope', () => {
    // CborReader throws when it runs out of bytes mid-item
    const envelope = writeEnvelope({ subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope.slice(0, envelope.length - 1));
    expect(parseResult).toMatchObject({ status: 'malformed' });
  });

  it("should reject an envelope that isn't an array", () => {
    // CborReader throws when the major type doesn't match
    const writer = new Serialization.CborWriter();
    writer.writeInt(1n);
    const parseResult = parseEnvelope(writer.encode());
    expect(parseResult).toMatchObject({ status: 'malformed' });
  });

  it('should reject an array of the wrong length', () => {
    const envelope = writeEnvelope({ length: 4, subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toEqual({ status: 'malformed', reason: 'expected array of length 3' });
  });

  it('should reject an unknown envelope version', () => {
    const envelope = writeEnvelope({ version: ENVELOPE_VERSION_TAG + 1n, subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toEqual({ status: 'unsupported-version' });
  });

  it('should reject an unknown era tag', () => {
    const envelope = writeEnvelope({ eraTag: DIJKSTRA_ERA_TAG - 1n, subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toEqual({ status: 'unsupported-version' });
  });

  it('should reject the wrong CBOR tag', () => {
    const envelope = writeEnvelope({ tag: Serialization.CborTag.Set, subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toEqual({
      status: 'malformed',
      reason: `expected tag ${Serialization.CborTag.EncodedCborDataItem}, found ${Serialization.CborTag.Set}`,
    });
  });

  it('should reject a missing CBOR tag', () => {
    const envelope = writeEnvelope({ tag: null, subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toMatchObject({ status: 'malformed' });
  });

  it('should reject an invalid subtx', () => {
    const envelope = writeEnvelope({ subTxBytes: new Uint8Array([0x01, 0x02, 0x03]) });
    const parseResult = parseEnvelope(envelope);
    expect(parseResult).toMatchObject({ status: 'malformed' });
  });

  it('should reject trailing data', () => {
    const envelope = writeEnvelope({ subTxBytes: emptySubTxBytes() });
    const parseResult = parseEnvelope(new Uint8Array([...envelope, 0x00]));
    expect(parseResult).toEqual({ status: 'malformed', reason: 'unexpected trailing data' });
  });
});

describe('serializeEnvelope', () => {
  function emptySubTx(): SubTransaction {
    return SubTransaction.fromCore({
      body: {
        inputs: [],
        outputs: [],
      },
      witness: {
        signatures: new Map(),
      },
    });
  }

  it('should write [version, era, #6.24(subtx)]', () => {
    const subTx = emptySubTx();
    const envelope = Buffer.from(serializeEnvelope(subTx)).toString('hex');
    // 83 = array(3), 01 = version, 07 = era, d818 = tag 24
    expect(envelope.startsWith('830107d818')).toBe(true);
    expect(envelope.endsWith(subTx.toCbor())).toBe(true);
  });

  it('should round trip through parseEnvelope', () => {
    const subTx = emptySubTx();
    const parseResult = parseEnvelope(serializeEnvelope(subTx));
    expect(parseResult.status).toBe('ok');
    if (parseResult.status === 'ok') {
      expect(parseResult.value.toCbor()).toBe(subTx.toCbor());
      expect(parseResult.value.getId()).toBe(subTx.getId());
    }
  });

  it('should carry a parsed subtx verbatim, even when it is not canonically encoded', () => {
    // The body map {0: [], 1: []}, with key 0 written in two bytes (18 00) rather than one.
    const nonCanonical = '83' + 'a2180080' + '0180' + 'a0' + 'f6';
    const subTx = SubTransaction.fromCbor(HexBlob(nonCanonical));
    const parseResult = parseEnvelope(serializeEnvelope(subTx));
    expect(parseResult.status).toBe('ok');
    if (parseResult.status === 'ok') {
      expect(parseResult.value.toCbor()).toBe(nonCanonical);
    }
  });
});
