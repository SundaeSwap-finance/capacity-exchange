import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config.js';

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
  return wallet.endsWith('.skey') ? wallet.slice(0, wallet.lastIndexOf('/')) || '.' : wallet;
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
