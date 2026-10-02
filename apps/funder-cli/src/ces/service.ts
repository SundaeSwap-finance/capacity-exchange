import type { CardanoCli, ProtocolParams, Utxo } from '../cardano/cli.js';
import { utxoRef } from '../cardano/cli.js';
import {
  addValue,
  assembleBatch,
  type AssembleResult,
  assertRoundTrip,
  decodeEnvelope,
  decodeSubTransactionBytes,
  decodeTx,
  emptyValue,
  FORBIDDEN_SUB_TX_KEYS,
  hexToBytes,
  imbalance,
  offerFee,
  readEnvelope,
  type SubTransaction,
  sumValues,
  type TxInput,
  type Value,
  verifyWitnesses,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { unitToCliAsset } from '../cardano/value.js';
import { OfferRejected } from './protocol.js';

/**
 * The stand-in exchange: what a service does behind `POST /offers`, run locally because the
 * route does not exist on the server yet. Each function is one stage of CIP-0198's offer
 * lifecycle, and refuses with one of its rejection codes.
 */

export interface ReceivedOffer {
  sub: SubTransaction;
  signers: string[];
}

/**
 * CIP-0198's stateless checks, which run while the request is still open: a refusal here
 * replaces the `202`. None of them needs chain state.
 *
 * CIP-0198 also requires a finite validity upper bound. This stand-in does not enforce one yet;
 * whether Musashi accepts a validity interval in a sub-transaction is still open.
 */
export function receiveOffer(envelopeHex: string): ReceivedOffer {
  let subBytes: Uint8Array;
  try {
    subBytes = decodeEnvelope(hexToBytes(envelopeHex));
  } catch (err) {
    const message = (err as Error).message;
    throw new OfferRejected(/Unsupported/.test(message) ? 'unsupported-version' : 'malformed', message);
  }

  let sub: SubTransaction;
  try {
    sub = decodeSubTransactionBytes(subBytes);
  } catch (err) {
    throw new OfferRejected('malformed', (err as Error).message);
  }
  if (sub.inputs.length === 0) {
    throw new OfferRejected('malformed', 'an offer needs at least one spend input');
  }

  let signers: string[];
  try {
    signers = verifyWitnesses(sub);
  } catch (err) {
    throw new OfferRejected('malformed', (err as Error).message);
  }

  // Not malformed: sound offers, just not ones this service will price.
  for (const [key, label] of FORBIDDEN_SUB_TX_KEYS) {
    if (sub.body.has(key)) {
      throw new OfferRejected('not-interested', `this service does not carry offers containing ${label}`);
    }
  }
  return { sub, signers };
}

export interface QuoteTerms {
  /** Lovelace the price was quoted for. */
  capacity: bigint;
  priceUnit: string;
  priceAmount: bigint;
}

export interface VerifiedOffer {
  sub: SubTransaction;
  /** `consumed − produced`: tokens positive, lovelace negative. */
  imbalance: Value;
  /** Lovelace the offer's outputs need beyond its inputs. */
  lovelaceNeeded: bigint;
  /** Tokens the offer leaves on the table. */
  offered: Map<string, bigint>;
  /** The offer's own share of the batch fee. */
  feeShare: bigint;
}

/**
 * CIP-0198's chain-state checks, plus whether the offer pays what was quoted for what it
 * needs. These run after the `202`, so a refusal is recorded against the offer rather than
 * returned to the request.
 */
export function verifyOffer(
  sub: SubTransaction,
  resolve: (input: TxInput) => Value | undefined,
  quote: QuoteTerms,
  pp: Pick<ProtocolParams, 'txFeeFixed' | 'txFeePerByte'>,
  ownInputs: TxInput[] = []
): VerifiedOffer {
  const own = new Set(ownInputs.map((i) => `${i.txHash}#${i.index}`));
  for (const input of sub.inputs) {
    const ref = `${input.txHash}#${input.index}`;
    if (own.has(ref)) {
      throw new OfferRejected('not-interested', `offer spends ${ref}, which belongs to this service`);
    }
    if (!resolve(input)) {
      throw new OfferRejected('invalidated', `input ${ref} is no longer unspent`);
    }
  }

  const delta = imbalance(sub, (i) => resolve(i) ?? emptyValue());
  const needs = [...delta.assets].filter(([, q]) => q < 0n);
  if (needs.length > 0) {
    throw new OfferRejected('not-interested', 'offer needs tokens from its batch; this service only supplies ADA');
  }
  const offered = new Map(delta.assets);
  const lovelaceNeeded = delta.lovelace < 0n ? -delta.lovelace : 0n;

  const paid = offered.get(quote.priceUnit) ?? 0n;
  if (paid < quote.priceAmount) {
    throw new OfferRejected(
      'not-interested',
      `offer leaves ${paid} of the quoted asset; the quote was for ${quote.priceAmount}`
    );
  }

  const feeShare = offerFee(sub.bytes.length, pp.txFeeFixed, pp.txFeePerByte);
  if (lovelaceNeeded + feeShare > quote.capacity) {
    throw new OfferRejected(
      'not-interested',
      `offer needs ${lovelaceNeeded} lovelace plus a ${feeShare} lovelace fee share, ` +
        `more than the ${quote.capacity} the quote covered`
    );
  }

  return { sub, imbalance: delta, lovelaceNeeded, offered, feeShare };
}

/**
 * The exchange's UTxO with the most lovelace: the most room for what a batch gives away. It is
 * paid in tokens, so its UTxOs carry them; whatever this one holds rides along into the change.
 */
export function selectFunding(utxos: Utxo[], address: string): Utxo {
  if (utxos.length === 0) {
    throw new Error(`Simulated exchange wallet ${address} has no UTxO to fund a batch with`);
  }
  return utxos.reduce((a, b) => (b.value.lovelace > a.value.lovelace ? b : a));
}

export interface BuildBatchParams {
  cli: CardanoCli;
  offers: VerifiedOffer[];
  funding: Utxo;
  address: string;
  pp: ProtocolParams;
  resolve: (input: TxInput) => Value;
  /** Where `build-raw` writes the exchange's own draft. */
  draftPath: string;
}

export interface BuiltBatch extends AssembleResult {
  /** The lovelace every offer needed, which the exchange gave up. */
  released: bigint;
  /** Tokens the exchange took in, summed over the offers. */
  earned: Value;
  /** Batch cost beyond the offers' own fee shares, carried by the exchange. */
  overhead: bigint;
}

/**
 * Builds the batch around verified offers. `cardano-cli build-raw` makes the exchange's own
 * part — its funding input and a change output that absorbs the offers' tokens — and the
 * offers are then spliced in verbatim, since `build-raw` has no way to carry them.
 */
export function buildBatch(params: BuildBatchParams): BuiltBatch {
  const { cli, offers, funding, address, pp, resolve, draftPath } = params;

  const released = offers.reduce((total, o) => total + o.lovelaceNeeded, 0n);
  const earned = sumValues(offers.map((o) => ({ lovelace: 0n, assets: o.offered })));
  const changeLovelace = funding.value.lovelace - released;
  if (changeLovelace <= 0n) {
    throw new Error(`Funding UTxO ${utxoRef(funding)} is too small to release ${released} lovelace`);
  }

  // No shell is involved, so the multi-asset part carries no quotes of its own.
  // The change keeps whatever tokens the funding UTxO already held, plus what the offers pay.
  const changeAssets = addValue({ lovelace: 0n, assets: funding.value.assets }, earned);
  const assets = [...changeAssets.assets].map(([unit, qty]) => `+${qty} ${unitToCliAsset(unit)}`).join('');
  cli.buildRaw([
    '--tx-in',
    utxoRef(funding),
    '--tx-out',
    `${address}+${changeLovelace}${assets}`,
    '--fee',
    '0',
    '--out-file',
    draftPath,
  ]);
  const envelope = readEnvelope(draftPath);
  assertRoundTrip(envelope.cborHex);

  const result = assembleBatch({
    draft: decodeTx(envelope.cborHex),
    changeIndex: 0,
    subs: offers.map((o) => o.sub),
    resolve,
    txFeeFixed: pp.txFeeFixed,
    txFeePerByte: pp.txFeePerByte,
    utxoCostPerByte: pp.utxoCostPerByte,
    witnessCount: 1,
  });

  const shares = offers.reduce((total, o) => total + o.feeShare, 0n);
  return { ...result, released, earned, overhead: result.fee - shares };
}
