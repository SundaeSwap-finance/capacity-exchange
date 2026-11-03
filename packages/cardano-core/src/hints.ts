/** CIP-0198 price hints: the CBOR a service signs and publishes. */

import { Serialization } from '@cardano-sdk/core';
import { Ed25519PublicKey } from '@cardano-sdk/crypto';
const { CborWriter } = Serialization;
type CborWriter = Serialization.CborWriter;

/** A Cardano asset: ADA, or a native asset by its unit, the policy id followed by the hex asset name. */
export type Asset = { type: 'ada' } | { type: 'native'; unit: string };

/** An exact fraction of bigints. */
export interface Rational {
  numerator: bigint;
  /** Always positive. */
  denominator: bigint;
}

export interface Rung {
  /** Units of the spent asset at this rung, not cumulative. `null` is unbounded, and only allowed on the last rung. */
  supply: bigint | null;
  /** Units of the paid asset per unit spent. */
  perUnit: Rational;
}

/** A CIP-0198 `price`: what a service charges in `paid` for what it spends of `spent`. */
export interface Price {
  paid: Asset;
  spent: Asset;
  base: bigint;
  /** Filled in order. Never empty. */
  ladder: Rung[];
}

/** The fields of a CIP-0198 `hints_body`. Its `scope` is always empty: these hints apply to every offer. */
export interface HintsBody {
  /** POSIX milliseconds. */
  producedAt: bigint;
  prices: Price[];
  /** The issuer's registration asset name, 28 bytes. */
  registration: Uint8Array;
  issuerVkey: Uint8Array;
}

/**
 * The blake2b-224 hash of `vkey`. It also fills a hint's `registration` field: the CIP names a
 * registration asset there, and an unregistered service has none. Needs `cryptoReady()` to
 * have resolved.
 */
export function keyHashOf(vkey: Uint8Array): Uint8Array {
  return fromHex(Ed25519PublicKey.fromBytes(vkey).hash().hex());
}

const ADA_TAG = 121;
const NATIVE_TAG = 122;
const RATIONAL_TAG = 30;
const POLICY_HEX_LENGTH = 56;

const fromHex = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'));

function writeAsset(writer: CborWriter, asset: Asset): void {
  if (asset.type === 'ada') {
    writer.writeTag(ADA_TAG).writeStartArray(0);
    return;
  }
  writer
    .writeTag(NATIVE_TAG)
    .writeStartArray(2)
    .writeByteString(fromHex(asset.unit.slice(0, POLICY_HEX_LENGTH)))
    .writeByteString(fromHex(asset.unit.slice(POLICY_HEX_LENGTH)));
}

function writePrice(writer: CborWriter, price: Price): void {
  writer.writeStartArray(4);
  writeAsset(writer, price.paid);
  writeAsset(writer, price.spent);
  writer.writeInt(price.base).writeStartArray(price.ladder.length);
  for (const rung of price.ladder) {
    writer.writeStartArray(2);
    if (rung.supply === null) {
      writer.writeNull();
    } else {
      writer.writeInt(rung.supply);
    }
    writer
      .writeTag(RATIONAL_TAG)
      .writeStartArray(2)
      .writeInt(rung.perUnit.numerator)
      .writeInt(rung.perUnit.denominator);
  }
}

/** The CBOR of a `hints_body`. */
export function encodeHintsBody(body: HintsBody): Uint8Array {
  const writer = new CborWriter();
  writer.writeStartArray(5).writeInt(body.producedAt).writeStartArray(0);
  writer.writeStartArray(body.prices.length);
  for (const price of body.prices) {
    writePrice(writer, price);
  }
  return writer.writeByteString(body.registration).writeByteString(body.issuerVkey).encode();
}

/** The CBOR of a signed `hints`: the body's bytes and the signature over them. */
export function encodeHints(bodyBytes: Uint8Array, signature: Uint8Array): Uint8Array {
  return new CborWriter().writeStartArray(2).writeByteString(bodyBytes).writeByteString(signature).encode();
}
