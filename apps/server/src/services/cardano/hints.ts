import { createPrivateKey, createPublicKey, sign } from 'crypto';
import { readFileSync } from 'fs';
import {
  encodeHints,
  encodeHintsBody,
  keyHashOf,
  type HintsBody,
} from '@capacity-exchange/cardano-core';
import type { AdaPriceFormula } from '../../config/prices.js';
import type { Asset } from '../../utils/asset.js';
import { sliceTiers, type Price, type PriceSchedule } from './ladder.js';
import type { CardanoWalletService } from './wallet.js';

/** Signs CIP-0198 hint sets under the service's key. */
export interface HintSigner {
  /** Ed25519 public key, 32 bytes. */
  vkey: Uint8Array;
  /** Ed25519 signature, 64 bytes. */
  sign(message: Uint8Array): Uint8Array;
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

function toAsset(currency: AdaPriceFormula['currency']): Asset {
  return currency.type === 'cardano:ada'
    ? { type: 'ada' }
    : { type: 'native', unit: currency.rawId };
}

/** The schedules the ADA formulas that `checkAdaFormulas` accepted publish, each spending ADA. */
export function toSchedules(formulas: AdaPriceFormula[]): PriceSchedule[] {
  return formulas.map((formula) => ({
    paid: toAsset(formula.currency),
    spent: { type: 'ada' },
    base: BigInt(formula.basePrice),
    tiers: formula.tiers.map((tier) => ({
      above: BigInt(tier.above),
      perUnit: {
        numerator: BigInt(tier.rateNumerator),
        denominator: BigInt(tier.rateDenominator),
      },
    })),
  }));
}

/** Publishes the service's price hints, priced from what its wallet holds now. */
export class CardanoHintService {
  constructor(
    private readonly schedules: PriceSchedule[],
    private readonly wallet: Pick<CardanoWalletService, 'lovelace'>,
    private readonly signer: HintSigner,
    private readonly now: () => number = Date.now,
  ) {}

  /** Each schedule priced at the current balance; a pair whose ladder comes out empty is left out. */
  currentPrices(): Price[] {
    const lovelace = this.wallet.lovelace();
    return this.schedules
      .map(({ tiers, ...pair }) => {
        return {
          ...pair,
          ladder: sliceTiers(tiers, lovelace),
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
      registration: keyHashOf(this.signer.vkey),
    };
    const bodyBytes = encodeHintsBody(body);
    const signature = this.signer.sign(bodyBytes);
    const encodedHints = encodeHints(bodyBytes, signature);
    return [Buffer.from(encodedHints).toString('hex')];
  }
}
