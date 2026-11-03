import { beforeAll, describe, it, expect } from 'vitest';
import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import { cryptoReady, encodeHints, encodeHintsBody, keyHashOf, type Asset, type HintsBody, type Price } from '../src';

const { CborReader, CborReaderState } = Serialization;

beforeAll(cryptoReady);

// testnet/cardano/server.skey's public key, and its hash.
const VKEY_HEX = '0db194fa0f6c49b1a4e3a8b5c6ea075b198fecad18b5197d822255575af3c8fd';
const REGISTRATION_HEX = '8cbeb3d6f68cfa2a38ec170f843bd56cc2202b5383b223dfaa119402';

const POLICY_HEX = 'aa'.repeat(28);
const NAME_HEX = '534e454b';
const ADA: Asset = { type: 'ada' };
const TOKEN: Asset = { type: 'native', unit: POLICY_HEX + NAME_HEX };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const bytes = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

interface Tagged {
  tag: number;
  value: Cbor;
}
type Cbor = bigint | Uint8Array | null | Cbor[] | Tagged;

/** Decodes the CBOR subset the CIP's hint structures use. */
function decodeCbor(data: Uint8Array): Cbor {
  const reader = new CborReader(HexBlob.fromBytes(data));
  const item = readItem(reader);
  expect(reader.getBytesRemaining()).toBe(0);
  return item;
}

function readItem(reader: InstanceType<typeof CborReader>): Cbor {
  switch (reader.peekState()) {
    case CborReaderState.UnsignedInteger:
      return reader.readUInt();
    case CborReaderState.ByteString:
      return reader.readByteString();
    case CborReaderState.Null:
      reader.readNull();
      return null;
    case CborReaderState.Tag:
      return { tag: Number(reader.readTag()), value: readItem(reader) };
    case CborReaderState.StartArray: {
      reader.readStartArray();
      const items: Cbor[] = [];
      while (reader.peekState() !== CborReaderState.EndArray) {
        items.push(readItem(reader));
      }
      reader.readEndArray();
      return items;
    }
    default:
      throw new Error(`unexpected CBOR item ${reader.peekState()}`);
  }
}

/** A price as the CIP's CDDL lays it out. */
function expectedPrice(price: Price): Cbor {
  const asset = (a: Asset): Cbor =>
    a.type === 'ada'
      ? { tag: 121, value: [] }
      : { tag: 122, value: [bytes(a.unit.slice(0, 56)), bytes(a.unit.slice(56))] };
  return [
    asset(price.paid),
    asset(price.spent),
    price.base,
    price.ladder.map((rung) => [rung.supply, { tag: 30, value: [rung.perUnit.numerator, rung.perUnit.denominator] }]),
  ];
}

/** Turns byte strings into hex so `toEqual` compares contents, not types. */
function normalise(item: unknown): unknown {
  if (item instanceof Uint8Array) {
    return hex(item);
  }
  if (Array.isArray(item)) {
    return item.map(normalise);
  }
  if (item !== null && typeof item === 'object') {
    return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, normalise(v)]));
  }
  return item;
}

const PRICE: Price = {
  paid: TOKEN,
  spent: ADA,
  base: 100_000n,
  ladder: [
    { supply: 200_000_000n, perUnit: { numerator: 13n, denominator: 1000n } },
    { supply: 400_000_000n, perUnit: { numerator: 17n, denominator: 1000n } },
  ],
};

const BODY: HintsBody = {
  producedAt: 1_761_739_200_000n,
  prices: [PRICE, { ...PRICE, paid: ADA, base: 0n }],
  registration: bytes(REGISTRATION_HEX),
  issuerVkey: bytes(VKEY_HEX),
};

const OPEN: Price = {
  ...PRICE,
  ladder: [{ supply: null, perUnit: { numerator: 1n, denominator: 1n } }],
};

describe('keyHashOf', () => {
  it('is the blake2b-224 hash of the key', () => {
    expect(hex(keyHashOf(bytes(VKEY_HEX)))).toBe(REGISTRATION_HEX);
  });
});

describe('encodeHintsBody', () => {
  it('lays the body out as the CIP hints_body, unscoped', () => {
    expect(normalise(decodeCbor(encodeHintsBody(BODY)))).toEqual(
      normalise([BODY.producedAt, [], BODY.prices.map(expectedPrice), BODY.registration, BODY.issuerVkey])
    );
  });

  it('encodes an unbounded rung as null', () => {
    const decoded = decodeCbor(encodeHintsBody({ ...BODY, prices: [OPEN] })) as Cbor[];
    expect(normalise(decoded[2])).toEqual(normalise([expectedPrice(OPEN)]));
  });
});

describe('encodeHints', () => {
  it('pairs the body bytes with the signature', () => {
    const bodyBytes = bytes('a0');
    const signature = new Uint8Array(64).fill(7);
    expect(normalise(decodeCbor(encodeHints(bodyBytes, signature)))).toEqual(normalise([bodyBytes, signature]));
  });
});
