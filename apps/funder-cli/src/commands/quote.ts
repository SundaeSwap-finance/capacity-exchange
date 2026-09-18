import { fetchAllPrices, isPayableWith, type Price } from '../ces/client.js';
import type { Config } from '../config.js';
import { assetLabel } from '../cardano/value.js';
import { formatAsset, plain, step, warn, wrote } from '../log.js';
import { ARTIFACTS, readJson, type Selection, type StoredQuote, workPath, writeJson } from './state.js';

export interface QuoteOptions {
  cesUrl: string[];
  feeEstimate: string;
  selection: string;
}

/**
 * Asks every configured exchange what it would charge to cover the estimated fee, and keeps
 * the cheapest price the caller can actually pay. This is a real call against a real endpoint.
 */
export async function runQuote(config: Config, options: QuoteOptions): Promise<void> {
  const amount = BigInt(options.feeEstimate);
  const selection = readJson<Selection>(options.selection, 'UTxO selection');
  const held = new Set(Object.keys(selection.assets));

  for (const url of options.cesUrl) {
    step('quote', `GET ${url.replace(/\/$/, '')}/api/prices?currency=ADA&amount=${amount}`);
  }
  const { quotes, failures } = await fetchAllPrices(options.cesUrl, amount);
  for (const failure of failures) {
    warn(`${failure.url} did not answer: ${failure.message}`);
  }
  if (quotes.length === 0) {
    throw new Error('No exchange returned a price');
  }

  plain('');
  plain('  instance                        pay in            price          quote id');
  type Candidate = { url: string; quoteId: string; price: Price };
  const candidates: Candidate[] = [];
  for (const quote of quotes) {
    for (const price of quote.prices) {
      const payable = isPayableWith(price, held);
      const label = price.currency.type === 'cardano:native' ? assetLabel(price.currency.rawId) : price.currency.id;
      const rendered = payable ? formatAsset(BigInt(price.amount)) : '—';
      const note = payable ? '' : '  (skipped: caller does not hold this)';
      plain(
        `  ${quote.url.padEnd(31)} ${label.padEnd(17)} ${rendered.padEnd(14)} ${payable ? quote.quoteId : ''}${note}`
      );
      if (payable) {
        candidates.push({ url: quote.url, quoteId: quote.quoteId, price });
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error('No exchange quoted a currency this wallet holds');
  }

  const best = candidates.reduce((a, b) => (BigInt(b.price.amount) < BigInt(a.price.amount) ? b : a));
  plain('');
  step(
    'quote',
    `best: ${best.url} @ ${formatAsset(BigInt(best.price.amount))} ` +
      `${assetLabel(best.price.currency.rawId)}   (quote ${best.quoteId})`
  );

  const stored: StoredQuote = {
    url: best.url,
    quoteId: best.quoteId,
    feeEstimate: amount.toString(),
    priceAmount: best.price.amount,
    priceUnit: best.price.currency.rawId,
    currency: best.price.currency,
  };
  const quotePath = workPath(config, ARTIFACTS.quote);
  writeJson(quotePath, stored);
  wrote('quote', quotePath);
  step('quote', `next: ces-fund offer ${quotePath} --simulate-ces --simulated-ces-signing-key <key>`);
}
