import { beforeAll, describe, it, expect, vi } from 'vitest';
import { createPublicKey, verify } from 'crypto';
import { fileURLToPath } from 'url';
import { Serialization } from '@cardano-sdk/core';
import { cryptoReady } from '@capacity-exchange/cardano-core';
import {
  CardanoHintService,
  encodeHints,
  encodeHintsBody,
  readHintSigner,
  keyHashOf,
  toSchedules,
  type HintSigner,
  type HintsBody,
} from './hints.js';
import type { AdaPriceFormula } from '../../config/prices.js';
import type { Asset } from '../../utils/asset.js';
import type { Price, PriceSchedule } from './ladder.js';

const { CborReader, CborReaderState } = Serialization;

beforeAll(cryptoReady);

// testnet/cardano/server.skey, and what its key derives to.
const SKEY_FILE = fileURLToPath(
  new URL('../../../../../testnet/cardano/server.skey', import.meta.url),
);
const VKEY_HEX = '0db194fa0f6c49b1a4e3a8b5c6ea075b198fecad18b5197d822255575af3c8fd';
const REGISTRATION_HEX = '8cbeb3d6f68cfa2a38ec170f843bd56cc2202b5383b223dfaa119402';

const POLICY_HEX = 'aa'.repeat(28);
const NAME_HEX = '534e454b';
const ADA: Asset = { type: 'ada' };
const TOKEN: Asset = { type: 'native', unit: POLICY_HEX + NAME_HEX };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

function verifies(vkey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  const key = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(vkey).toString('base64url') },
    format: 'jwk',
  });
  return verify(null, message, key, signature);
}

interface Tagged {
  tag: number;
  value: Cbor;
}
type Cbor = bigint | Uint8Array | null | Cbor[] | Tagged;

/** Decodes the CBOR subset the CIP's hint structures use. */
function decodeCbor(bytes: Uint8Array): Cbor {
  type HexBlob = ConstructorParameters<typeof CborReader>[0];
  const reader = new CborReader(Buffer.from(bytes).toString('hex') as HexBlob);
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

/** A price as the CIP's CDDL lays it out, with byte strings as hex. */
function expectedPrice(price: Price): Cbor {
  const asset = (a: Asset): Cbor =>
    a.type === 'ada'
      ? { tag: 121, value: [] }
      : {
          tag: 122,
          value: [Buffer.from(a.unit.slice(0, 56), 'hex'), Buffer.from(a.unit.slice(56), 'hex')],
        };
  return [
    asset(price.paid),
    asset(price.spent),
    price.base,
    price.ladder.map((rung) => [
      rung.supply,
      { tag: 30, value: [rung.perUnit.numerator, rung.perUnit.denominator] },
    ]),
  ];
}

/** Turns byte strings into plain arrays so `toEqual` compares contents, not types. */
function normalise(item: Cbor): unknown {
  if (item instanceof Uint8Array) {
    return hex(item);
  }
  if (Array.isArray(item)) {
    return item.map(normalise);
  }
  if (item !== null && typeof item === 'object') {
    return { tag: item.tag, value: normalise(item.value) };
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

describe('readHintSigner', () => {
  it('derives the public key from a cardano-cli signing key', () => {
    expect(hex(readHintSigner(SKEY_FILE).vkey)).toBe(VKEY_HEX);
  });

  it('signs with Ed25519 under that key', () => {
    const signer = readHintSigner(SKEY_FILE);
    const message = Buffer.from('hints');
    const signature = signer.sign(message);
    expect(signature).toHaveLength(64);
    expect(verifies(signer.vkey, message, signature)).toBe(true);
  });
});

describe('keyHashOf', () => {
  it('is the blake2b-224 hash of the key', () => {
    expect(hex(keyHashOf(Buffer.from(VKEY_HEX, 'hex')))).toBe(REGISTRATION_HEX);
  });
});

describe('encodeHintsBody', () => {
  const body: HintsBody = {
    producedAt: 1_761_739_200_000n,
    prices: [PRICE, { ...PRICE, paid: ADA, base: 0n }],
    registration: Buffer.from(REGISTRATION_HEX, 'hex'),
    issuerVkey: Buffer.from(VKEY_HEX, 'hex'),
  };

  it('lays the body out as the CIP hints_body, unscoped', () => {
    expect(normalise(decodeCbor(encodeHintsBody(body)))).toEqual(
      normalise([
        body.producedAt,
        [],
        body.prices.map(expectedPrice),
        body.registration,
        body.issuerVkey,
      ]),
    );
  });

  it('encodes an unbounded rung as null', () => {
    const open: Price = {
      ...PRICE,
      ladder: [{ supply: null, perUnit: { numerator: 1n, denominator: 1n } }],
    };
    const decoded = decodeCbor(encodeHintsBody({ ...body, prices: [open] })) as Cbor[];
    expect(normalise(decoded[2])).toEqual(normalise([expectedPrice(open)]));
  });
});

describe('encodeHints', () => {
  it('pairs the body bytes with the signature', () => {
    const bodyBytes = Buffer.from('a0', 'hex');
    const signature = new Uint8Array(64).fill(7);
    expect(normalise(decodeCbor(encodeHints(bodyBytes, signature)))).toEqual(
      normalise([bodyBytes, signature]),
    );
  });
});

describe('toSchedules', () => {
  const FORMULA: AdaPriceFormula = {
    currency: { type: 'cardano:native', rawId: POLICY_HEX + NAME_HEX },
    basePrice: '100',
    tiers: [
      { above: '1000', rateNumerator: '11', rateDenominator: '1000' },
      { above: '100', rateNumerator: '17', rateDenominator: '1000' },
    ],
  };
  const rate = (numerator: bigint) => ({ numerator, denominator: 1000n });

  it('prices a token paid for ADA spent, tier for tier', () => {
    expect(toSchedules([FORMULA])).toEqual([
      {
        paid: TOKEN,
        spent: ADA,
        base: 100n,
        tiers: [
          { above: 1000n, perUnit: rate(11n) },
          { above: 100n, perUnit: rate(17n) },
        ],
      },
    ]);
  });

  it('prices ADA paid in ADA', () => {
    const adaForAda = { ...FORMULA, currency: { type: 'cardano:ada' as const, rawId: '' } };
    expect(toSchedules([adaForAda])[0]).toMatchObject({ paid: ADA, spent: ADA });
  });
});

describe('CardanoHintService', () => {
  const R = { numerator: 13n, denominator: 1000n };
  const SCHEDULE: PriceSchedule = {
    paid: TOKEN,
    spent: ADA,
    base: 100_000n,
    tiers: [{ above: 100_000_000n, perUnit: R }],
  };
  const NOW = 1_761_739_200_000;
  // A fixed key, so a signer bug fails the signer tests rather than these.
  const signer: HintSigner = {
    vkey: Buffer.from(VKEY_HEX, 'hex'),
    sign: (message) => readHintSigner(SKEY_FILE).sign(message),
  };

  const serviceWith = (lovelace: bigint) =>
    new CardanoHintService([SCHEDULE], { lovelace: () => lovelace }, signer, () => NOW);

  it('reads the balance once for every pair', () => {
    const lovelace = vi.fn(() => 700_000_000n);
    const service = new CardanoHintService([SCHEDULE, SCHEDULE], { lovelace }, signer, () => NOW);
    expect(service.currentPrices()).toHaveLength(2);
    expect(lovelace).toHaveBeenCalledOnce();
  });

  it("prices each pair from the wallet's balance", () => {
    expect(serviceWith(700_000_000n).currentPrices()).toEqual([
      { paid: TOKEN, spent: ADA, base: 100_000n, ladder: [{ supply: 600_000_000n, perUnit: R }] },
    ]);
  });

  it('leaves out a pair whose balance is at or below its lowest tier', () => {
    expect(serviceWith(100_000_000n).currentPrices()).toEqual([]);
  });

  it('serves no hint set when no pair has a ladder', () => {
    expect(serviceWith(50_000_000n).hints()).toEqual([]);
  });

  it('serves one signed set of the current prices', () => {
    const service = serviceWith(700_000_000n);
    const sets = service.hints();
    expect(sets).toHaveLength(1);

    const [bodyBytes, signature] = decodeCbor(Buffer.from(sets[0], 'hex')) as Uint8Array[];
    expect(hex(bodyBytes)).toBe(
      hex(
        encodeHintsBody({
          producedAt: BigInt(NOW),
          prices: service.currentPrices(),
          registration: keyHashOf(signer.vkey),
          issuerVkey: signer.vkey,
        }),
      ),
    );
    expect(verifies(signer.vkey, bodyBytes, signature)).toBe(true);
  });
});
