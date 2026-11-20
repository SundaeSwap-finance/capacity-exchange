import { describe, it, expect } from 'vitest';
import { Serialization } from '@cardano-sdk/core';
import { CborWriter } from '../src';

type Writer = CborWriter | Serialization.CborWriter;

/** Runs `write` against both writers and checks they produce the same bytes. */
function expectSameAsUpstream(write: (w: Writer) => void) {
  const ours = new CborWriter();
  const upstream = new Serialization.CborWriter();
  write(ours);
  write(upstream);
  expect(Buffer.from(ours.encode()).toString('hex')).toBe(Buffer.from(upstream.encode()).toString('hex'));
  expect(ours.encodeAsHex()).toBe(upstream.encodeAsHex());
}

const INTS: (number | bigint)[] = [
  0,
  1,
  23,
  24,
  255,
  256,
  65535,
  65536,
  0xffffffff,
  0x100000000,
  Number.MAX_SAFE_INTEGER,
  2n ** 64n - 1n,
  -1,
  -24,
  -25,
  -256,
  -257,
  -65536,
  -65537,
  -(2 ** 32),
  -(2 ** 32) - 1,
  -(2n ** 64n),
];

describe('CborWriter', () => {
  it.each(INTS)('writeInt(%s) matches upstream', (n) => {
    expectSameAsUpstream((w) => w.writeInt(n));
  });

  it.each(INTS.filter((n) => typeof n === 'number'))('length/tag headers for %s match upstream', (n) => {
    if (n < 0) {
      return;
    }
    expectSameAsUpstream((w) => w.writeStartArray(n).writeStartMap(n).writeTag(n));
  });

  it.each([0n, 1n, 255n, 256n, 2n ** 64n, 2n ** 200n + 7n, -1n, -256n, -(2n ** 64n) - 1n])(
    'writeBigInteger(%s) matches upstream',
    (n) => {
      expectSameAsUpstream((w) => w.writeBigInteger(n));
    }
  );

  it.each([0, -0, 1, -1, 1.5, 65504, 2 ** -24, 2 ** -20, 100000, NaN, Infinity, -Infinity])(
    'writeFloat(%s) matches upstream where upstream is correct',
    (f) => {
      expectSameAsUpstream((w) => w.writeFloat(f));
    }
  );

  it.each([1 + 2 ** -30, 65504 + 2 ** -20])('writeFloat(%s) rounds to half precision like upstream', (f) => {
    expectSameAsUpstream((w) => w.writeFloat(f));
  });

  it.each([0.1, 1 / 3, 1e-5, 3.4e38])('writeFloat(%s) matches upstream where it needs a double', (f) => {
    // Upstream writes a float32 then 4 uninitialized bytes; compare all but those.
    const ours = new CborWriter().writeFloat(f).encode();
    const upstream = new Serialization.CborWriter().writeFloat(f).encode();
    expect(ours.length).toBe(9);
    expect(ours.subarray(0, 5)).toEqual(upstream.subarray(0, 5));
  });

  it.each([1.5, 24.5, 300.5, 70000.5])('writeInt(%s) truncates like upstream', (n) => {
    expectSameAsUpstream((w) => w.writeInt(n));
  });

  it.each([2 ** 32 + 0.5, -0.5, -1.5])('writeInt(%s) throws like upstream', (n) => {
    expect(() => new Serialization.CborWriter().writeInt(n)).toThrow(RangeError);
    expect(() => new CborWriter().writeInt(n)).toThrow(RangeError);
  });

  it('writeInt throws on values over 64 bits like upstream', () => {
    expect(() => new Serialization.CborWriter().writeInt(2n ** 64n)).toThrow(RangeError);
    expect(() => new CborWriter().writeInt(2n ** 64n)).toThrow(RangeError);
  });

  it('strings, bytes, simple values and nesting match upstream', () => {
    expectSameAsUpstream((w) =>
      w
        .writeStartArray()
        .writeTextString('')
        .writeTextString('héllo wörld 🎉')
        .writeTextString('x'.repeat(300))
        .writeByteString(new Uint8Array(0))
        .writeByteString(new Uint8Array(70000).fill(9))
        .writeBoolean(true)
        .writeBoolean(false)
        .writeNull()
        .writeUndefined()
        .writeStartMap(1)
        .writeTextString('k')
        .writeEncodedValue(new Uint8Array([0x82, 0x01, 0x02]))
        .writeEndArray()
    );
  });

  it('grows past its initial capacity and encode() returns a copy', () => {
    const w = new CborWriter();
    w.writeStartArray();
    for (let i = 0; i < 10000; i++) {
      w.writeInt(i);
    }
    w.writeEndArray();
    const first = w.encode();
    w.writeInt(1);
    expect(w.encode().length).toBe(first.length + 1);
    const reader = new Serialization.CborReader(Buffer.from(first).toString('hex') as never);
    reader.readStartArray();
    for (let i = 0; i < 10000; i++) {
      expect(reader.readInt()).toBe(BigInt(i));
    }
    reader.readEndArray();
  });

  it('reset() clears the buffer', () => {
    const w = new CborWriter().writeInt(1000);
    w.reset();
    w.writeInt(1);
    expect(w.encode()).toEqual(new Uint8Array([1]));
  });
});
