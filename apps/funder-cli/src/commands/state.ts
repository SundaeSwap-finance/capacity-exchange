import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Config } from '../config.js';
import type { OfferState, Rejection } from '../ces/protocol.js';

/** Files the commands hand to one another, all under the work directory. */
export const ARTIFACTS = {
  protocolParams: 'protocol-params.json',
  selection: 'selection.json',
  draft: 'offer.draft.json',
  quote: 'quote.json',
  offer: 'offer.json',
  submission: 'submission.json',
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
  /** The exchange the offer went to. */
  url: string;
  state: OfferState;
  /** Present when the state is `rejected`. */
  reason?: Rejection;
}

/**
 * `quote.json`: a price worked out from an exchange's signed hints. CIP-0198 hints are not a
 * firm quote and carry no id; the signed set is kept so the price can be checked later.
 */
export interface StoredQuote {
  url: string;
  /** The lovelace the price was worked out for. */
  capacity: string;
  priceAmount: string;
  priceUnit: string;
  /** When the exchange signed the hints, POSIX milliseconds. */
  producedAt: string;
  /** Hex of the issuer's verification key. */
  issuerVkey: string;
  /** Hex of the signed hint set the price came from. */
  hints: string;
}

/** How a quote is named in output, in place of the id CIP-0198 hints do not have. */
export function quoteLabel(quote: StoredQuote): string {
  return `hints signed ${new Date(Number(quote.producedAt)).toISOString()} by ${quote.issuerVkey.slice(0, 8)}…`;
}
