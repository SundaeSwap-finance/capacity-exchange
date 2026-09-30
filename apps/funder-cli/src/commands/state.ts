import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Config } from '../config.js';
import type { OfferState } from '../ces/protocol.js';

/** Files the commands hand to one another, all under the work directory. */
export const ARTIFACTS = {
  protocolParams: 'protocol-params.json',
  selection: 'selection.json',
  draft: 'offer.draft.json',
  quote: 'quote.json',
  offer: 'offer.json',
  submission: 'submission.json',
  /** The stand-in exchange's own files. A real exchange keeps these to itself. */
  batchDraft: 'simulated-ces/batch.draft.tx',
  batch: 'simulated-ces/batch.tx',
  batchSigned: 'simulated-ces/batch.tx.signed',
} as const;

export function workPath(config: Config, name: string): string {
  const path = join(config.workDir, name);
  mkdirSync(dirname(path), { recursive: true });
  return path;
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
 * Who built a batch. Nothing in the transaction says whether a real exchange was involved, so
 * it is recorded when the batch is built and carried in its envelope description, which
 * travels with the file.
 */
export type BatchSource = { simulated: true } | { simulated: false; url: string };

const SOURCE_PREFIX = 'batch built by ';
const SOURCE_SEPARATOR = ' · ';

export function describeBatchSource(source: BatchSource): string {
  return `${SOURCE_PREFIX}${source.simulated ? 'simulated CES' : source.url}`;
}

export function parseBatchSource(description: string | undefined): BatchSource | undefined {
  const part = description?.split(SOURCE_SEPARATOR).find((p) => p.startsWith(SOURCE_PREFIX));
  if (!part) {
    return undefined;
  }
  const value = part.slice(SOURCE_PREFIX.length).trim();
  return value === 'simulated CES' ? { simulated: true } : { simulated: false, url: value };
}

/** Appends the provenance note to an envelope description without discarding what was there. */
export function withBatchSource(description: string, source: BatchSource | undefined): string {
  return source ? [description, describeBatchSource(source)].filter(Boolean).join(SOURCE_SEPARATOR) : description;
}

/** The tag `show` prints beside the top-level transaction. Absent when provenance was never recorded. */
export function batchSourceLabel(source: BatchSource | undefined): string | undefined {
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

/** `offer.draft.json`: the caller's unsigned offer, before the price is known. */
export interface StoredDraft {
  /** Hex CBOR of the unsigned sub-transaction body. */
  body: string;
  /** Bech32 address the change goes back to, and so the one the price comes out of. */
  callerAddress: string;
  /** Lovelace asked for: the change output's minimum plus the offer's own share of the fee. */
  capacity: string;
}

/** `offer.json`: the signed offer, as it goes on the wire. */
export interface StoredOffer {
  /** The sub-transaction's TxId, which is also how the chain will know it. */
  offerId: string;
  /** Hex of the CIP-0198 envelope. */
  envelope: string;
}

/** `submission.json`: what `fund` learned, so `status` can pick up where it left off. */
export interface StoredSubmission {
  offerId: string;
  source: BatchSource;
  state: OfferState;
  batchTxId?: string;
}

export interface StoredQuote {
  url: string;
  quoteId: string;
  /** The lovelace the price was quoted for. */
  capacity: string;
  priceAmount: string;
  priceUnit: string;
  currency: { id: string; type: string; rawId: string };
}
