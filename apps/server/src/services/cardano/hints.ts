import { createPrivateKey, createPublicKey, sign } from 'crypto';
import { readFileSync } from 'fs';
import { CborWriter, Ed25519PublicKey } from '@capacity-exchange/cardano-core';
import type { CardanoPairPrice, RawCurrency } from '../../config/prices.js';
import type { Asset } from '../../utils/asset.js';
import { sliceTiers, type Price, type PriceSchedule } from './ladder.js';

/** Signs CIP-0198 hint sets under the service's key. */
export interface HintSigner {
  /** Ed25519 public key, 32 bytes. */
  vkey: Uint8Array;
  /** Ed25519 signature, 64 bytes. */
  sign(message: Uint8Array): Uint8Array;
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

// PKCS#8 wrapping of a raw Ed25519 seed, which is how Node's crypto takes a private key.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Reads a cardano-cli `PaymentSigningKeyShelley_ed25519` text envelope. */
export function readHintSigner(path: string): HintSigner {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as { type?: string; cborHex?: string };
  if (envelope.type !== 'PaymentSigningKeyShelley_ed25519' || !envelope.cborHex) {
    throw new Error(`${path} is not a cardano-cli PaymentSigningKeyShelley_ed25519 key`);
  }
  // The CBOR of a 32-byte string: header 0x5820, then the Ed25519 seed.
  if (!/^5820[0-9a-fA-F]{64}$/.test(envelope.cborHex)) {
    throw new Error(`${path} does not hold a 32-byte Ed25519 seed`);
  }
  const seed = Buffer.from(envelope.cborHex.slice(4), 'hex');
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  const vkey = Buffer.from(createPublicKey(privateKey).export({ format: 'jwk' }).x!, 'base64url');
  return {
    vkey: new Uint8Array(vkey),
    sign: (message) => new Uint8Array(sign(null, message, privateKey)),
  };
}

/**
 * What fills a hint's `registration` field: the blake2b-224 hash of `vkey`. The CIP names a
 * registration asset there, and an unregistered service has none. Needs `cryptoReady()` to
 * have resolved.
 */
export function registrationOf(vkey: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(Ed25519PublicKey.fromBytes(vkey).hash().hex(), 'hex'));
}

const ADA_TAG = 121;
const NATIVE_TAG = 122;
const RATIONAL_TAG = 30;
const POLICY_HEX_LENGTH = 56;

function writeAsset(writer: CborWriter, asset: Asset): void {
  if (asset.type === 'ada') {
    writer.writeTag(ADA_TAG).writeStartArray(0);
    return;
  }
  writer
    .writeTag(NATIVE_TAG)
    .writeStartArray(2)
    .writeByteString(Buffer.from(asset.unit.slice(0, POLICY_HEX_LENGTH), 'hex'))
    .writeByteString(Buffer.from(asset.unit.slice(POLICY_HEX_LENGTH), 'hex'));
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
  return new CborWriter()
    .writeStartArray(2)
    .writeByteString(bodyBytes)
    .writeByteString(signature)
    .encode();
}

function toAsset(currency: RawCurrency): Asset {
  return currency.type === 'cardano:ada'
    ? { type: 'ada' }
    : { type: 'native', unit: currency.rawId };
}

/** Converts price pairs that `checkCardanoPrices` accepted. */
export function toSchedules(prices: CardanoPairPrice[]): PriceSchedule[] {
  return prices.map((price) => ({
    paid: toAsset(price.paid),
    spent: toAsset(price.spent),
    base: BigInt(price.base),
    tiers: price.tiers.map((tier) => ({
      above: BigInt(tier.above),
      perUnit: {
        numerator: BigInt(tier.perUnit.numerator),
        denominator: BigInt(tier.perUnit.denominator),
      },
    })),
  }));
}

/** Publishes the service's price hints, priced from what its wallet holds now. */
export class CardanoHintService {
  constructor(
    private readonly schedules: PriceSchedule[],
    /** The service's current holding of an asset it spends. */
    private readonly balance: (asset: Asset) => bigint,
    private readonly signer: HintSigner,
    private readonly now: () => number = Date.now,
  ) {}

  /** Each schedule priced at the current balance; a pair whose ladder comes out empty is left out. */
  currentPrices(): Price[] {
    return this.schedules
      .map(({ tiers, ...pair }) => {
        return {
          ...pair,
          ladder: sliceTiers(tiers, this.balance(pair.spent)),
        };
      })
      .filter((p) => p.ladder.length > 0);
  }

  /** The hex-encoded signed hint sets `GET /hints` serves: one set, or none when no pair has a ladder. */
  hints(): string[] {
    const prices = this.currentPrices();
    if (prices.length === 0) {
      return [];
    }
    const body: HintsBody = {
      producedAt: BigInt(this.now()),
      prices,
      issuerVkey: this.signer.vkey,
      registration: registrationOf(this.signer.vkey),
    };
    const bodyBytes = encodeHintsBody(body);
    const signature = this.signer.sign(bodyBytes);
    const encodedHints = encodeHints(bodyBytes, signature);
    return [Buffer.from(encodedHints).toString('hex')];
  }
}
