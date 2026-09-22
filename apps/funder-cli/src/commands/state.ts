import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Config } from '../config.js';
import type { OfferResponse } from '../ces/client.js';

/** Files the commands hand to one another, all under the work directory. */
export const ARTIFACTS = {
  protocolParams: 'protocol-params.json',
  draft: 'parent.draft.tx',
  quote: 'quote.json',
  offer: 'offer.json',
  nested: 'parent.nested.tx',
  signed: 'parent.nested.tx.signed',
  selection: 'selection.json',
} as const;

export function workPath(config: Config, name: string): string {
  mkdirSync(config.workDir, { recursive: true });
  return join(config.workDir, name);
}

export function readJson<T>(path: string, what: string): T {
  if (!existsSync(path)) {
    throw new Error(`Missing ${what} at ${path}. Run the earlier step first.`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** A wallet is a directory holding payment.skey (and the files derived from it). */
export function signingKeyPath(wallet: string): string {
  return wallet.endsWith('.skey') ? wallet : join(wallet, 'payment.skey');
}

export function walletDir(wallet: string): string {
  return wallet.endsWith('.skey') ? dirname(wallet) : wallet;
}

/**
 * Where an offer came from. Nothing in the transaction says whether a real exchange was
 * contacted, so it is recorded when the offer is obtained and carried in the nested
 * transaction's envelope description, which travels with the file.
 */
export type OfferSource = { simulated: true } | { simulated: false; url: string };

/** `offer.json`: the exchange's response verbatim, plus our own note of where it came from. */
export type StoredOffer = OfferResponse & { source?: OfferSource };

const SOURCE_PREFIX = 'offer from ';
const SOURCE_SEPARATOR = ' · ';

export function describeOfferSource(source: OfferSource): string {
  return `${SOURCE_PREFIX}${source.simulated ? 'simulated CES' : source.url}`;
}

export function parseOfferSource(description: string | undefined): OfferSource | undefined {
  const part = description?.split(SOURCE_SEPARATOR).find((p) => p.startsWith(SOURCE_PREFIX));
  if (!part) {
    return undefined;
  }
  const value = part.slice(SOURCE_PREFIX.length).trim();
  return value === 'simulated CES' ? { simulated: true } : { simulated: false, url: value };
}

/** Appends the provenance note to an envelope description without discarding what was there. */
export function withOfferSource(description: string, source: OfferSource | undefined): string {
  return source ? [description, describeOfferSource(source)].filter(Boolean).join(SOURCE_SEPARATOR) : description;
}

/** The tag `show` prints beside a sub-transaction. Absent when provenance was never recorded. */
export function offerSourceLabel(source: OfferSource | undefined): string | undefined {
  if (!source) {
    return undefined;
  }
  return source.simulated ? '[simulated CES]' : `[CES ${source.url}]`;
}

/** Records which UTxO `balance`/`build` selected so later steps need not re-choose. */
export interface Selection {
  address: string;
  txHash: string;
  index: number;
  lovelace: string;
  assets: Record<string, string>;
}

export interface StoredQuote {
  url: string;
  quoteId: string;
  feeEstimate: string;
  priceAmount: string;
  priceUnit: string;
  currency: { id: string; type: string; rawId: string };
}
