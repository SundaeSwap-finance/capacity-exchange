/**
 * CIP-0198 price hints, as the server publishes them at `GET /api/cardano/hints`: decoding,
 * checking the issuer's signature, and pricing a capacity up a ladder. The encoder lives in
 * `@capacity-exchange/cardano-core`; this is its inverse, kept here because only the caller
 * needs to read hints.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import type { Asset, HintsBody, Price, Rung } from '@capacity-exchange/cardano-core';
import { bytesToHex } from '../tx/codec.js';

const { CborReader, CborReaderState } = Serialization;
type Reader = InstanceType<typeof CborReader>;

const ADA_TAG = 121;
const NATIVE_TAG = 122;
const RATIONAL_TAG = 30;

export interface SignedHints {
  body: HintsBody;
  /** Hex of the body bytes the signature covers. */
  bodyHex: string;
}

function expectTag(reader: Reader, tag: number, what: string): void {
  const got = Number(reader.readTag());
  if (got !== tag) {
    throw new Error(`hints: expected tag ${tag} for ${what}, got ${got}`);
  }
}

function readArray<T>(reader: Reader, item: (r: Reader) => T): T[] {
  const length = reader.readStartArray();
  const items: T[] = [];
  while (length === null ? reader.peekState() !== CborReaderState.EndArray : items.length < length) {
    items.push(item(reader));
  }
  reader.readEndArray();
  return items;
}

function readAsset(reader: Reader): Asset {
  const tag = Number(reader.readTag());
  if (tag === ADA_TAG) {
    readArray(reader, () => {
      throw new Error('hints: ADA asset carries fields');
    });
    return { type: 'ada' };
  }
  if (tag === NATIVE_TAG) {
    const [policy, name] = readArray(reader, (r) => r.readByteString());
    return { type: 'native', unit: bytesToHex(policy) + bytesToHex(name ?? new Uint8Array()) };
  }
  throw new Error(`hints: unknown asset tag ${tag}`);
}

function readRung(reader: Reader): Rung {
  reader.readStartArray();
  let supply: bigint | null;
  if (reader.peekState() === CborReaderState.Null) {
    reader.readNull();
    supply = null;
  } else {
    supply = reader.readInt();
  }
  expectTag(reader, RATIONAL_TAG, 'a rate');
  const [numerator, denominator] = readArray(reader, (r) => r.readInt());
  reader.readEndArray();
  if (!denominator || denominator <= 0n) {
    throw new Error('hints: rate has a non-positive denominator');
  }
  return { supply, perUnit: { numerator, denominator } };
}

function readPrice(reader: Reader): Price {
  reader.readStartArray();
  const paid = readAsset(reader);
  const spent = readAsset(reader);
  const base = reader.readInt();
  const ladder = readArray(reader, readRung);
  reader.readEndArray();
  return { paid, spent, base, ladder };
}

/**
 * Decodes one signed hint set and checks its signature against the issuer key it carries.
 * That proves the set is intact and from whoever holds that key, not that the key belongs to
 * a registered service: hints here are unregistered, so trust in the key comes from the URL.
 */
export function decodeHints(hex: string): SignedHints {
  const outer = new CborReader(HexBlob(hex));
  outer.readStartArray();
  const bodyBytes = outer.readByteString();
  const signature = outer.readByteString();
  outer.readEndArray();

  const reader = new CborReader(HexBlob(bytesToHex(bodyBytes)));
  reader.readStartArray();
  const producedAt = reader.readInt();
  const scope = readArray(reader, (r) => r.readEncodedValue());
  if (scope.length > 0) {
    throw new Error('hints: scoped hints are not supported');
  }
  const prices = readArray(reader, readPrice);
  const registration = reader.readByteString();
  const issuerVkey = reader.readByteString();
  reader.readEndArray();

  if (!ed25519.verify(signature, bodyBytes, issuerVkey)) {
    throw new Error("hints: signature does not verify against the issuer's key");
  }
  return { body: { producedAt, prices, registration, issuerVkey }, bodyHex: bytesToHex(bodyBytes) };
}

function sameAsset(a: Asset, b: Asset): boolean {
  return a.type === 'ada' ? b.type === 'ada' : b.type === 'native' && a.unit === b.unit;
}

/** The unit `formatValue` and the rest of this CLI use for an asset. */
export function assetUnit(asset: Asset): string {
  return asset.type === 'ada' ? 'lovelace' : asset.unit;
}

/**
 * What spending `amount` of ADA costs under `price`: its base, plus `amount` filled up the
 * ladder rung by rung, rounded up to a whole unit as the server does. `undefined` when the
 * ladder's supply runs out first.
 */
export function priceFor(price: Price, amount: bigint): bigint | undefined {
  let numerator = 0n;
  let denominator = 1n;
  let left = amount;
  for (const rung of price.ladder) {
    const used = rung.supply === null || rung.supply > left ? left : rung.supply;
    numerator = numerator * rung.perUnit.denominator + rung.perUnit.numerator * used * denominator;
    denominator *= rung.perUnit.denominator;
    left -= used;
    if (left === 0n) {
      return price.base + (numerator + denominator - 1n) / denominator;
    }
  }
  return undefined;
}

/** The prices in a hint set for ADA capacity, paid in something other than ADA. */
export function adaPrices(body: HintsBody): Price[] {
  return body.prices.filter((p) => sameAsset(p.spent, { type: 'ada' }) && p.paid.type === 'native');
}
