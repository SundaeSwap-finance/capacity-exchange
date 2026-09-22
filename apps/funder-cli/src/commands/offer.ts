import { requestOffer, type OfferResponse } from '../ces/client.js';
import { simulateOffer } from '../ces/simulate.js';
import { CardanoCli, utxoRef } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { assetLabel } from '../cardano/value.js';
import { banner, formatAda, plain, step, wrote } from '../log.js';
import {
  ARTIFACTS,
  type OfferSource,
  readJson,
  signingKeyPath,
  type StoredOffer,
  type StoredQuote,
  walletDir,
  workPath,
  writeJson,
} from './state.js';

export interface OfferOptions {
  simulateCes?: boolean;
  simulatedCesSigningKey?: string;
  cesUrl?: string;
  margin: string;
  offerTtl: string;
}

/**
 * Obtains the partial transaction that funds the caller's fee.
 *
 * The mode is always explicit. There is no default, so a recording can never imply an
 * exchange round trip that did not happen.
 */
export function assertExactlyOneMode(options: Pick<OfferOptions, 'simulateCes' | 'cesUrl'>): void {
  // Both coerced: an absent --simulate-ces is `undefined`, which is not `false`.
  if (Boolean(options.simulateCes) === Boolean(options.cesUrl)) {
    throw new Error(
      'Choose exactly one of --simulate-ces or --ces-url, so it is always clear whether an ' +
        'exchange was really contacted.'
    );
  }
}

export async function runOffer(config: Config, quotePath: string, options: OfferOptions): Promise<void> {
  assertExactlyOneMode(options);
  const quote = readJson<StoredQuote>(quotePath, 'quote');
  step('offer', `quote ${quote.quoteId} from ${quote.url} (${quotePath})`);

  const response = options.simulateCes
    ? runSimulated(config, options, quote)
    : await requestOffer(options.cesUrl!, { quoteId: quote.quoteId, offerCurrency: quote.currency.id });

  plain('');
  plain('response (shape matches CreateOfferResponse):');
  plain(JSON.stringify({ ...response, serializedTx: `${response.serializedTx.slice(0, 24)}…` }, null, 2));
  const offerPath = workPath(config, ARTIFACTS.offer);
  // The printout above is the response verbatim; `source` is our own note, so that later steps
  // can say which mode produced this offer instead of assuming one.
  const source: OfferSource = options.simulateCes ? { simulated: true } : { simulated: false, url: options.cesUrl! };
  writeJson(offerPath, { ...response, source } satisfies StoredOffer);
  wrote('offer', offerPath);
  const draftPath = workPath(config, ARTIFACTS.draft);
  step('offer', `next: ces-fund splice --draft ${draftPath} --quote ${quotePath} --offer ${offerPath}`);
}

function runSimulated(config: Config, options: OfferOptions, quote: StoredQuote): OfferResponse {
  const keyFile = options.simulatedCesSigningKey;
  if (!keyFile) {
    throw new Error('--simulate-ces requires --simulated-ces-signing-key');
  }

  banner('SIMULATED CES', ['No HTTP request is made. This step stands in for POST /offer.']);

  const cli = new CardanoCli(config);
  const price = new Map([[quote.priceUnit, BigInt(quote.priceAmount)]]);
  const result = simulateOffer({
    cli,
    signingKeyFile: signingKeyPath(keyFile),
    scratchDir: walletDir(keyFile),
    feeEstimate: BigInt(quote.feeEstimate),
    price,
    priceCurrency: quote.currency,
    protocolParams: cli.queryProtocolParams(),
    margin: BigInt(options.margin),
    offerTtlSeconds: Number(options.offerTtl),
  });

  step('simulated-ces', `wallet   ${keyFile}`);
  step('simulated-ces', `address  ${result.address}`);
  step(
    'simulated-ces',
    `selected ${utxoRef(result.selected).slice(0, 8)}…#${result.selected.index}  (${formatAda(result.selected.value.lovelace)} ADA)`
  );
  step('simulated-ces', `fee estimate ${quote.feeEstimate} + pad ${result.pad} = ${result.released} lovelace released`);
  step('simulated-ces', `price ${quote.priceAmount} ${assetLabel(quote.priceUnit)}`);
  const size = Buffer.from(result.response.serializedTx, 'hex').length;
  step('simulated-ces', `signed sub-transaction body  ${result.sub.bodyHash.slice(0, 6)}…  (${size} bytes)`);

  return result.response;
}
