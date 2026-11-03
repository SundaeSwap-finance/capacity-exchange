import { beforeAll, describe, it, expect, vi } from 'vitest';
import { createPublicKey, verify } from 'crypto';
import { fileURLToPath } from 'url';
import { Serialization } from '@cardano-sdk/core';
import { cryptoReady, encodeHintsBody, keyHashOf } from '@capacity-exchange/cardano-core';
import { CardanoHintService, toSchedules } from './hints.js';
import { readSigningKeyFile } from '../../config/cardanoKeys.js';
import type { AdaPriceFormula } from '../../config/prices.js';
import type { Asset } from '../../utils/asset.js';
import type { PriceSchedule } from './ladder.js';

beforeAll(cryptoReady);

// testnet/cardano/server.skey, and its public key.
const SKEY_FILE = fileURLToPath(
  new URL('../../../../../testnet/cardano/server.skey', import.meta.url),
);
const VKEY_HEX = '0db194fa0f6c49b1a4e3a8b5c6ea075b198fecad18b5197d822255575af3c8fd';

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
  const keyPair = readSigningKeyFile(SKEY_FILE);
  const vkey = Buffer.from(VKEY_HEX, 'hex');

  const serviceWith = (lovelace: bigint) =>
    new CardanoHintService([SCHEDULE], { lovelace: () => lovelace }, keyPair, () => NOW);

  it('reads the balance once for every pair', () => {
    const lovelace = vi.fn(() => 700_000_000n);
    const service = new CardanoHintService([SCHEDULE, SCHEDULE], { lovelace }, keyPair, () => NOW);
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

    const reader = new Serialization.CborReader(
      sets[0] as ConstructorParameters<typeof Serialization.CborReader>[0],
    );
    expect(reader.readStartArray()).toBe(2);
    const bodyBytes = reader.readByteString();
    const signature = reader.readByteString();
    reader.readEndArray();
    expect(reader.getBytesRemaining()).toBe(0);
    expect(hex(bodyBytes)).toBe(
      hex(
        encodeHintsBody({
          producedAt: BigInt(NOW),
          prices: service.currentPrices(),
          registration: keyHashOf(vkey),
          issuerVkey: vkey,
        }),
      ),
    );
    expect(verifies(vkey, bodyBytes, signature)).toBe(true);
  });
});
