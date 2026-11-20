import { fetchAllHints } from '../ces/client.js';
import { adaPrices, assetUnit, priceFor } from '../ces/hints.js';
import type { Config } from '../config.js';
import { assetLabel } from '../cardano/value.js';
import { bytesToHex } from '../tx/codec.js';
import { plain, step, warn, wrote } from '../log.js';
import { ARTIFACTS, quoteLabel, readJson, type Selection, type StoredQuote, workPath, writeJson } from './state.js';

export interface QuoteOptions {
  cesUrl: string[];
  capacity: string;
  selection: string;
}

/**
 * Reads every configured exchange's signed CIP-0198 price hints, works out what each would
 * charge for the capacity the offer needs, and keeps the cheapest price the caller can pay.
 * The hints are real, fetched from a real endpoint and checked against the issuer's
 * signature; the arithmetic up the price ladder is the caller's own.
 */
export async function runQuote(config: Config, options: QuoteOptions): Promise<void> {
  const amount = BigInt(options.capacity);
  const selection = readJson<Selection>(options.selection, 'UTxO selection');

  for (const url of options.cesUrl) {
    step('quote', `GET ${url.replace(/\/$/, '')}/api/cardano/hints`);
  }
  const { hints, failures } = await fetchAllHints(options.cesUrl);
  for (const failure of failures) {
    warn(`${failure.url} did not answer: ${failure.message}`);
  }
  if (hints.length === 0) {
    throw new Error('No exchange returned price hints');
  }

  plain('');
  plain(`  priced for ${amount} lovelace`);
  plain('  instance                                      pay in       holds        price');
  type Candidate = StoredQuote & { held: bigint };
  const candidates: Candidate[] = [];
  for (const instance of hints) {
    if (instance.sets.length === 0) {
      plain(`  ${instance.url.padEnd(45)} (publishes no prices right now)`);
    }
    for (const { hex, body } of instance.sets) {
      step(
        'quote',
        `${instance.url}: signature verifies against issuer key ${bytesToHex(body.issuerVkey).slice(0, 8)}…`
      );
      for (const price of adaPrices(body)) {
        const unit = assetUnit(price.paid);
        const held = BigInt(selection.assets[unit] ?? '0');
        const owed = priceFor(price, amount);
        const rendered = owed === undefined ? 'out of supply' : owed.toString();
        plain(`  ${instance.url.padEnd(45)} ${assetLabel(unit).padEnd(12)} ${String(held).padEnd(12)} ${rendered}`);
        if (owed === undefined) {
          continue;
        }
        candidates.push({
          url: instance.url,
          capacity: amount.toString(),
          priceAmount: owed.toString(),
          priceUnit: unit,
          producedAt: body.producedAt.toString(),
          issuerVkey: bytesToHex(body.issuerVkey),
          hints: hex,
          held,
        });
      }
    }
  }
  plain('');

  const payable = candidates.filter((c) => c.held >= BigInt(c.priceAmount));
  if (payable.length === 0) {
    const nearest = candidates.reduce<Candidate | undefined>(
      (a, b) => (!a || BigInt(b.priceAmount) - b.held < BigInt(a.priceAmount) - a.held ? b : a),
      undefined
    );
    throw new Error(
      nearest
        ? `No exchange's price is payable from this wallet: the closest wants ${nearest.priceAmount} ` +
            `${assetLabel(nearest.priceUnit)}, and the selected UTxO holds ${nearest.held}`
        : 'No exchange prices ADA in an asset at all'
    );
  }

  // Only one asset is held in practice, so comparing raw amounts across instances is fair.
  const { held: _held, ...best } = payable.reduce((a, b) => (BigInt(b.priceAmount) < BigInt(a.priceAmount) ? b : a));
  step('quote', `best: ${best.url} @ ${best.priceAmount} ${assetLabel(best.priceUnit)}   (${quoteLabel(best)})`);
  step('quote', 'hints are not a firm quote: the exchange may have moved its price by the time the offer arrives');

  const quotePath = workPath(config, ARTIFACTS.quote);
  writeJson(quotePath, best);
  wrote('quote', quotePath);
  const draftPath = workPath(config, ARTIFACTS.draft);
  step('quote', `next: ces-fund commit --draft ${draftPath} --quote ${quotePath} --caller-wallet <dir>`);
}
