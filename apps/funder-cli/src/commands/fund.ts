import { CardanoCli } from '../cardano/cli.js';
import { assetLabel } from '../cardano/value.js';
import type { Config } from '../config.js';
import { submitOffer } from '../ces/client.js';
import { OFFERS_PATH, OfferRejected } from '../ces/protocol.js';
import { step, warn, wrote } from '../log.js';
import { reportWait } from './status.js';
import {
  ARTIFACTS,
  quoteLabel,
  readJson,
  type StoredOffer,
  type StoredQuote,
  type StoredSubmission,
  workPath,
  writeJson,
} from './state.js';

export interface FundOptions {
  quote: string;
  cesUrl?: string;
  wait?: boolean;
  timeout: string;
  pollInterval: string;
}

const trimSlash = (url: string) => url.replace(/\/$/, '');

/**
 * Hands the signed offer to an exchange, which builds, pays for and submits the batch that
 * carries it before it answers. With --wait, it then follows the chain itself rather than
 * taking the exchange's word for the outcome.
 */
export async function runFund(config: Config, offerPath: string, options: FundOptions): Promise<void> {
  const offer = readJson<StoredOffer>(offerPath, 'signed offer');
  const quote = readJson<StoredQuote>(options.quote, 'quote');
  const url = trimSlash(options.cesUrl ?? quote.url);
  if (url !== trimSlash(quote.url)) {
    warn(`the price came from ${quote.url}, but the offer is going to ${url}`);
  }

  step('fund', `POST ${url}${OFFERS_PATH}   offer ${offer.offerId.slice(0, 8)}…  (application/cbor)`);
  step('fund', `offer pays ${quote.priceAmount} ${assetLabel(quote.priceUnit)}, priced from ${quoteLabel(quote)}`);

  const submissionPath = workPath(config, ARTIFACTS.submission);
  const record = (submission: StoredSubmission) => {
    writeJson(submissionPath, submission);
    wrote('fund', submissionPath);
  };

  let accepted;
  try {
    accepted = await submitOffer(url, offer.envelope);
  } catch (err) {
    if (err instanceof OfferRejected) {
      record({ offerId: offer.offerId, url, state: 'rejected', reason: { code: err.code, message: err.message } });
      throw new Error(`Offer rejected (${err.message})`);
    }
    throw err;
  }
  if (accepted.offerId !== offer.offerId) {
    throw new Error(`the exchange accepted offer ${accepted.offerId}, but ${offer.offerId} was sent`);
  }
  // The server builds, signs and submits the batch inside the request, so a 202 already
  // means submitted. It does not name the batch, and has no route to ask about it later.
  step('fund', '202 Accepted — the exchange batched the offer and submitted it');
  record({ offerId: offer.offerId, url, state: 'submitted' });

  if (!options.wait) {
    step('fund', 'inclusion takes a few minutes on this network, not seconds');
    step('fund', `follow the chain with: ces-fund status --offer ${offer.offerId} --wait`);
    return;
  }
  step('fund', `following the chain for ${offer.offerId.slice(0, 8)}…#0 — the exchange's word is not the last one`);
  await reportWait(new CardanoCli(config), offer.offerId, options);
}
