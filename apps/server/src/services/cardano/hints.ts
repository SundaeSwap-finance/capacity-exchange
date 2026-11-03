import { sign } from 'crypto';
import {
  encodeHints,
  encodeHintsBody,
  keyHashOf,
  type HintsBody,
} from '@capacity-exchange/cardano-core';
import type { Ed25519KeyPair } from '../../config/cardanoKeys.js';
import type { AdaPriceFormula } from '../../config/prices.js';
import type { Asset } from '../../utils/asset.js';
import { sliceTiers, type Price, type PriceSchedule } from './ladder.js';
import type { CardanoWalletService } from './wallet.js';

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
    private readonly registrationKeyPair: Ed25519KeyPair,
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
    const { privateKey, publicKey } = this.registrationKeyPair;
    const body: HintsBody = {
      producedAt: BigInt(this.now()),
      prices,
      issuerVkey: publicKey,
      registration: keyHashOf(publicKey),
    };
    const bodyBytes = encodeHintsBody(body);
    const signature = new Uint8Array(sign(null, bodyBytes, privateKey));
    const encodedHints = encodeHints(bodyBytes, signature);
    return [Buffer.from(encodedHints).toString('hex')];
  }
}
