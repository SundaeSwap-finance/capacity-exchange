import { CardanoCli, utxoRef } from '../cardano/cli.js';
import {
  asArray,
  BODY_SUB_TRANSACTIONS,
  decodeSubTransaction,
  decodeTx,
  encodeTx,
  readEnvelope,
  subTransactionSigners,
  type Value,
  writeEnvelope,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { assetLabel, formatValue } from '../cardano/value.js';
import type { Config } from '../config.js';
import { getOfferStatus, submitOffer } from '../ces/client.js';
import { OFFERS_PATH, OfferRejected, type OfferStatus, stopsPolling } from '../ces/protocol.js';
import { buildBatch, receiveOffer, selectFunding, verifyOffer } from '../ces/service.js';
import { banner, check, formatAda, formatAsset, step, warn, wrote } from '../log.js';
import { reportWait } from './status.js';
import {
  ARTIFACTS,
  type BatchSource,
  readJson,
  signingKeyPath,
  type StoredOffer,
  type StoredQuote,
  type StoredSubmission,
  walletDir,
  withBatchSource,
  workPath,
  writeJson,
} from './state.js';

export interface FundOptions {
  quote: string;
  simulateCes?: boolean;
  simulatedCesWallet?: string;
  cesUrl?: string;
  wait?: boolean;
  timeout: string;
  pollInterval: string;
}

/**
 * The mode is always explicit. There is no default, so a recording can never imply an
 * exchange round trip that did not happen.
 */
export function assertExactlyOneMode(options: Pick<FundOptions, 'simulateCes' | 'cesUrl'>): void {
  // Both coerced: an absent --simulate-ces is `undefined`, which is not `false`.
  if (Boolean(options.simulateCes) === Boolean(options.cesUrl)) {
    throw new Error(
      'Choose exactly one of --simulate-ces or --ces-url, so it is always clear whether an ' +
        'exchange was really contacted.'
    );
  }
}

/**
 * Hands the signed offer to an exchange, which builds, pays for and submits the batch that
 * carries it. Acceptance is asynchronous: a `202` means the exchange will look at the offer,
 * not that it will carry it. So this reports every stage it can see, and then, with --wait,
 * follows the chain itself rather than taking the exchange's word for the outcome.
 */
export async function runFund(config: Config, offerPath: string, options: FundOptions): Promise<void> {
  assertExactlyOneMode(options);
  const offer = readJson<StoredOffer>(offerPath, 'signed offer');
  const quote = readJson<StoredQuote>(options.quote, 'quote');
  const source: BatchSource = options.simulateCes ? { simulated: true } : { simulated: false, url: options.cesUrl! };

  const status = options.simulateCes
    ? runSimulated(config, options, offer, quote)
    : await runReal(options.cesUrl!, offer, quote, options);

  const submission: StoredSubmission = {
    offerId: offer.offerId,
    source,
    state: status.state,
    ...(status.batchTxId ? { batchTxId: status.batchTxId } : {}),
  };
  const submissionPath = workPath(config, ARTIFACTS.submission);
  writeJson(submissionPath, submission);
  wrote('fund', submissionPath);

  if (status.state === 'rejected') {
    throw new Error(`Offer rejected (${status.reason?.code}): ${status.reason?.message}`);
  }

  if (!options.wait) {
    step('fund', 'inclusion takes a few minutes on this network, not seconds');
    step('fund', `follow the chain with: ces-fund status --offer ${offer.offerId} --wait`);
    return;
  }
  step('fund', `following the chain for ${offer.offerId.slice(0, 8)}…#0 — the exchange's word is not the last one`);
  await reportWait(new CardanoCli(config), offer.offerId, { ...options, mempoolTxid: status.batchTxId });
}

async function runReal(
  url: string,
  offer: StoredOffer,
  quote: StoredQuote,
  options: FundOptions
): Promise<OfferStatus> {
  step(
    'fund',
    `POST ${url.replace(/\/$/, '')}${OFFERS_PATH}   offer ${offer.offerId.slice(0, 8)}…  quote ${quote.quoteId.slice(0, 12)}…`
  );
  let accepted;
  try {
    accepted = await submitOffer(url, { envelope: offer.envelope, quoteId: quote.quoteId });
  } catch (err) {
    if (err instanceof OfferRejected) {
      return { offerId: offer.offerId, state: 'rejected', reason: { code: err.code, message: err.message } };
    }
    throw err;
  }
  step('fund', `202 Accepted — ${accepted.state}`);

  const started = Date.now();
  const timeoutMs = Number(options.timeout) * 1000;
  let last = accepted.state;
  let status: OfferStatus = { offerId: offer.offerId, state: accepted.state };
  while (!stopsPolling(status.state)) {
    if (Date.now() - started >= timeoutMs) {
      warn(`still ${status.state} at the exchange after ${options.timeout}s`);
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, Number(options.pollInterval) * 1000));
    status = await getOfferStatus(url, offer.offerId);
    if (status.state !== last) {
      step(
        'fund',
        `GET …/${offer.offerId.slice(0, 8)}… — ${status.state}${status.batchTxId ? `  batch ${status.batchTxId}` : ''}`
      );
      last = status.state;
    }
  }
  return status;
}

/**
 * Runs the exchange's side locally, stage by stage. Everything it submits is real; what it
 * stands in for is the exchange deciding to carry the offer, and settling the quote.
 */
function runSimulated(config: Config, options: FundOptions, offer: StoredOffer, quote: StoredQuote): OfferStatus {
  const wallet = options.simulatedCesWallet;
  if (!wallet) {
    throw new Error('--simulate-ces requires --simulated-ces-wallet');
  }
  banner('SIMULATED CES', [
    `No HTTP request is made. Each [simulated-ces] line stands in for what an`,
    `exchange does behind POST ${OFFERS_PATH}, all the way to submitting the batch.`,
  ]);
  const tag = 'simulated-ces';
  const rejected = (err: OfferRejected): OfferStatus => {
    step(tag, `rejected — ${err.code}: ${err.message}`);
    return { offerId: offer.offerId, state: 'rejected', reason: { code: err.code, message: err.message } };
  };

  // Stateless checks: these would answer the POST itself.
  let received;
  try {
    received = receiveOffer(offer.envelope);
  } catch (err) {
    if (err instanceof OfferRejected) {
      return rejected(err);
    }
    throw err;
  }
  const { sub, signers } = received;
  check(tag, 'envelope well-formed, era understood');
  check(tag, `${signers.length} witness(es) verify against the offer's body hash`);
  check(tag, 'moves value only: no certs, withdrawals, mint, votes, proposals or deposits');
  step(tag, `202 Accepted — offer ${sub.bodyHash.slice(0, 8)}… received`);
  if (sub.bodyHash !== offer.offerId) {
    throw new Error(`offer.json says ${offer.offerId} but the envelope carries ${sub.bodyHash}`);
  }

  // Chain-state checks.
  const cli = new CardanoCli(config);
  const pp = cli.queryProtocolParams();
  const address = cli.deriveAddress(signingKeyPath(wallet), walletDir(wallet));
  const ownUtxos = cli.queryUtxo(address);
  const resolved = new Map<string, Value>();
  for (const utxo of [...cli.queryUtxoByRefs(sub.inputs.map((i) => `${i.txHash}#${i.index}`)), ...ownUtxos]) {
    resolved.set(utxoRef(utxo), utxo.value);
  }
  const lookup = (i: { txHash: string; index: number }) => resolved.get(`${i.txHash}#${i.index}`);

  let verified;
  try {
    verified = verifyOffer(
      sub,
      lookup,
      { capacity: BigInt(quote.capacity), priceUnit: quote.priceUnit, priceAmount: BigInt(quote.priceAmount) },
      pp,
      ownUtxos
    );
  } catch (err) {
    if (err instanceof OfferRejected) {
      return rejected(err);
    }
    throw err;
  }
  check(tag, `inputs unspent: ${sub.inputs.map((i) => `${i.txHash.slice(0, 6)}…#${i.index}`).join(', ')}`);
  step(
    tag,
    `imbalance: offers ${[...verified.offered].map(([u, q]) => `${formatAsset(q)} ${assetLabel(u)}`).join(', ')}, ` +
      `needs ${formatAda(verified.lovelaceNeeded)} ADA`
  );
  check(
    tag,
    `pays the quoted ${formatAsset(BigInt(quote.priceAmount))} ${assetLabel(quote.priceUnit)} (quote ${quote.quoteId.slice(0, 12)}…)`
  );
  check(tag, `needs ${verified.lovelaceNeeded} + fee share ${verified.feeShare} ≤ ${quote.capacity} lovelace quoted`);
  step(tag, 'verified');

  // Batch construction.
  const funding = selectFunding(ownUtxos, address);
  const resolve = (i: { txHash: string; index: number }): Value => {
    const value = lookup(i);
    if (!value) {
      throw new Error(`unresolved input ${i.txHash}#${i.index}`);
    }
    return value;
  };
  const batch = buildBatch({
    cli,
    offers: [verified],
    funding,
    address,
    pp,
    resolve,
    draftPath: workPath(config, ARTIFACTS.batchDraft),
  });
  step(tag, `funding  ${utxoRef(funding).slice(0, 8)}…#${funding.index}  (${formatAda(funding.value.lovelace)} ADA)`);
  step(tag, 'offer inserted verbatim at body key 23');
  if (batch.declaredReferenceInputs.length > 0) {
    const refs = batch.declaredReferenceInputs.map((i) => `${i.txHash.slice(0, 6)}…#${i.index}`);
    step(tag, `declared ${refs.join(', ')} as reference inputs so the node resolves them`);
  }
  step(
    tag,
    `fee ${batch.fee} = offer's share ${verified.feeShare} + batch overhead ${batch.overhead}, paid by the CES`
  );
  step(tag, `gives up ${formatAda(batch.released + batch.fee)} ADA, takes in ${formatValue(batch.earned)}`);
  check(tag, 'batch balances');
  step(tag, 'included-in-batch');

  const batchPath = workPath(config, ARTIFACTS.batch);
  const envelope = readEnvelope(workPath(config, ARTIFACTS.batchDraft));
  writeEnvelope(batchPath, {
    ...envelope,
    description: withBatchSource(envelope.description, { simulated: true }),
    cborHex: encodeTx(batch.parent),
  });

  // Sign and submit, with the exchange's own key.
  const signedPath = workPath(config, ARTIFACTS.batchSigned);
  cli.sign(batchPath, signingKeyPath(wallet), signedPath);
  const offerSigners = subSigners(signedPath);
  if (JSON.stringify(offerSigners) !== JSON.stringify(signers)) {
    throw new Error("Signing the batch altered the offer's witness set; refusing to submit");
  }
  check(tag, "batch signed at the top level; the caller's witness inside the offer is untouched");
  const batchTxId = cli.txid(signedPath);
  cli.submit(signedPath);
  wrote(tag, signedPath);
  step(tag, `submitted — batch ${batchTxId} accepted into the mempool`);
  return { offerId: offer.offerId, state: 'submitted', batchTxId };
}

function subSigners(path: string): string[] {
  const tx = decodeTx(readEnvelope(path).cborHex);
  return asArray(tx.body.get(BODY_SUB_TRANSACTIONS)).flatMap((raw) =>
    subTransactionSigners(decodeSubTransaction(raw as unknown[]).items)
  );
}
