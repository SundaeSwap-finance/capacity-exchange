import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';

const { CborMajorType, CborTag } = Serialization;
type CborTag = Serialization.CborTag;

const INITIAL_CAPACITY = 64;

const ONE = 24;
const TWO = 25;
const FOUR = 26;
const EIGHT = 27;
const FALSE = 0xf4;
const TRUE = 0xf5;
const NULL = 0xf6;
const UNDEFINED = 0xf7;
const BREAK = 0xff;
const INDEFINITE_LENGTH_ARRAY = 0x9f;
const INDEFINITE_LENGTH_MAP = 0xbf;
const HALF = (7 << 5) | 25;
const FLOAT = (7 << 5) | 26;
const DOUBLE = (7 << 5) | 27;

const UINT32_LIMIT = 0x1_0000_0000;
const UINT64_LIMIT = 1n << 64n;

const textEncoder = new TextEncoder();

/**
 * Drop-in replacement for `Serialization.CborWriter` from `@cardano-sdk/core`.
 *
 * The upstream writer appends with `Buffer.concat` on every write, so encoding
 * is quadratic in output size. This one writes into a buffer that doubles in
 * size when full. Behavior otherwise mirrors upstream (@cardano-sdk/core
 * 0.47.1), including its known bugs, so this can be swapped back out once
 * upstream is fixed.
 */
export class CborWriter {
  #buffer = new Uint8Array(INITIAL_CAPACITY);
  #view = new DataView(this.#buffer.buffer);
  #length = 0;

  writeBigInteger(value: bigint): CborWriter {
    let tag: number = CborTag.UnsignedBigNum;
    if (value < 0n) {
      value = -value - 1n;
      tag = CborTag.NegativeBigNum;
    }
    let hex = value.toString(16);
    if (hex.length % 2) {
      hex = `0${hex}`;
    }
    this.writeTag(tag);
    this.writeByteString(Buffer.from(hex, 'hex'));
    return this;
  }

  writeBoolean(value: boolean): CborWriter {
    this.#pushUInt8(value ? TRUE : FALSE);
    return this;
  }

  writeByteString(value: Uint8Array): CborWriter {
    this.#writeTypeValue(CborMajorType.ByteString, value.length);
    this.#pushBytes(value);
    return this;
  }

  writeTextString(value: string): CborWriter {
    const bytes = textEncoder.encode(value);
    this.#writeTypeValue(CborMajorType.Utf8String, bytes.length);
    this.#pushBytes(bytes);
    return this;
  }

  writeEncodedValue(value: Uint8Array): CborWriter {
    this.#pushBytes(value);
    return this;
  }

  writeStartArray(length?: number): CborWriter {
    if (length !== undefined) {
      this.#writeTypeValue(CborMajorType.Array, length);
    } else {
      this.#pushUInt8(INDEFINITE_LENGTH_ARRAY);
    }
    return this;
  }

  /** Writes a break byte. Only valid after an indefinite-length `writeStartArray()`. */
  writeEndArray(): CborWriter {
    this.#pushUInt8(BREAK);
    return this;
  }

  writeStartMap(length?: number): CborWriter {
    if (length !== undefined) {
      this.#writeTypeValue(CborMajorType.Map, length);
    } else {
      this.#pushUInt8(INDEFINITE_LENGTH_MAP);
    }
    return this;
  }

  /** Writes a break byte. Only valid after an indefinite-length `writeStartMap()`. */
  writeEndMap(): CborWriter {
    this.#pushUInt8(BREAK);
    return this;
  }

  writeInt(value: number | bigint): CborWriter {
    if (value < 0) {
      this.#writeTypeValue(CborMajorType.NegativeInteger, -(BigInt(value) + 1n));
    } else {
      this.#writeTypeValue(CborMajorType.UnsignedInteger, value);
    }
    return this;
  }

  writeFloat(value: number): CborWriter {
    if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
      this.#pushUInt8(DOUBLE);
      this.#ensure(8);
      this.#view.setFloat64(this.#length, value);
      this.#length += 8;
      return this;
    }
    if (Number.isNaN(value)) {
      this.#pushUInt8(FLOAT);
      this.#ensure(4);
      this.#view.setUint32(this.#length, 0xffc00000);
      this.#length += 4;
      return this;
    }
    const half = encodeHalf(value);
    if (half !== undefined) {
      this.#pushUInt8(HALF);
      this.#ensure(2);
      this.#view.setUint16(this.#length, half);
      this.#length += 2;
    } else if (Math.fround(value) === value) {
      this.#pushUInt8(FLOAT);
      this.#ensure(4);
      this.#view.setFloat32(this.#length, value);
      this.#length += 4;
    } else {
      this.#pushUInt8(DOUBLE);
      this.#ensure(8);
      this.#view.setFloat32(this.#length, value);
      this.#view.setUint32(this.#length + 4, 0);
      this.#length += 8;
    }
    return this;
  }

  writeNull(): CborWriter {
    this.#pushUInt8(NULL);
    return this;
  }

  writeUndefined(): CborWriter {
    this.#pushUInt8(UNDEFINED);
    return this;
  }

  writeTag(tag: CborTag | number): CborWriter {
    this.#writeTypeValue(CborMajorType.Tag, tag);
    return this;
  }

  encodeAsHex(): HexBlob {
    return HexBlob.fromBytes(this.#buffer.subarray(0, this.#length));
  }

  /** Returns a copy of the bytes written so far. */
  encode(): Uint8Array {
    return this.#buffer.slice(0, this.#length);
  }

  reset(): void {
    this.#length = 0;
  }

  #writeTypeValue(majorType: number, value: number | bigint): void {
    const m = majorType << 5;
    if (value < 24) {
      this.#pushUInt8(m | Number(value));
    } else if (value < 256) {
      this.#ensure(2);
      this.#buffer[this.#length++] = m | ONE;
      this.#buffer[this.#length++] = Number(value);
    } else if (value < 65536) {
      this.#ensure(3);
      this.#buffer[this.#length++] = m | TWO;
      this.#view.setUint16(this.#length, Number(value));
      this.#length += 2;
    } else if (value < UINT32_LIMIT) {
      this.#ensure(5);
      this.#buffer[this.#length++] = m | FOUR;
      this.#view.setUint32(this.#length, Number(value));
      this.#length += 4;
    } else {
      const big = BigInt(value);
      if (big >= UINT64_LIMIT) {
        throw new RangeError(`CborWriter: ${value} does not fit in 64 bits`);
      }
      this.#ensure(9);
      this.#buffer[this.#length++] = m | EIGHT;
      this.#view.setBigUint64(this.#length, big);
      this.#length += 8;
    }
  }

  #pushUInt8(value: number): void {
    this.#ensure(1);
    this.#buffer[this.#length++] = value;
  }

  #pushBytes(bytes: Uint8Array): void {
    this.#ensure(bytes.length);
    this.#buffer.set(bytes, this.#length);
    this.#length += bytes.length;
  }

  #ensure(extra: number): void {
    const needed = this.#length + extra;
    if (needed <= this.#buffer.length) {
      return;
    }
    let capacity = this.#buffer.length * 2;
    while (capacity < needed) {
      capacity *= 2;
    }
    const next = new Uint8Array(capacity);
    next.set(this.#buffer.subarray(0, this.#length));
    this.#buffer = next;
    this.#view = new DataView(next.buffer);
  }
}

const f32 = new DataView(new ArrayBuffer(4));

/**
 * Encodes `value` as an IEEE 754 half-precision float, or returns undefined if
 * that would lose precision (judged on the float32 rounding of `value`). Same
 * logic as upstream's `encodeHalf`, which throws where this returns undefined.
 */
function encodeHalf(value: number): number | undefined {
  f32.setFloat32(0, value);
  const u = f32.getUint32(0);
  if ((u & 0x1fff) !== 0) {
    return undefined;
  }
  let s16 = (u >> 16) & 0x8000;
  const exp = (u >> 23) & 0xff;
  const mant = u & 0x7fffff;
  if (exp >= 113 && exp <= 142) {
    s16 += ((exp - 112) << 10) + (mant >> 13);
  } else if (exp >= 103 && exp < 113) {
    if (mant & ((1 << (126 - exp)) - 1)) {
      return undefined;
    }
    s16 += (mant + 0x800000) >> (126 - exp);
  } else {
    return undefined;
  }
  return s16;
}
