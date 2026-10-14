import { decodeEnvelope, FORBIDDEN_SUB_TX_KEYS, hexToBytes, type TxInput } from './codec.js';
import { offerFee } from './batch.js';
import { decodeSubTransactionBytes, imbalance, type SubTransaction, verifyWitnesses } from './subtx.js';
import { emptyValue, type Value } from './value.js';

/** CIP-0198's closed set of refusal reasons. */
export type RejectionCode =
  | 'malformed'
  | 'unsupported-version'
  | 'not-interested'
  | 'over-budget'
  | 'duplicate'
  | 'settled'
  | 'expired'
  | 'invalidated'
  | 'superseded'
  | 'busy'
  | 'not-ready';

export class OfferRejected extends Error {
  constructor(
    readonly code: RejectionCode,
    readonly detail: string
  ) {
    super(`${code}: ${detail}`);
  }
}

export interface ReceivedOffer {
  sub: SubTransaction;
  signers: string[];
}

/**
 * CIP-0198's stateless checks, which run while the request is still open: a refusal here
 * replaces the `202`. None of them needs chain state.
 *
 * CIP-0198 also requires a finite validity upper bound, which these checks do not enforce.
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
  const refs = sub.inputs.map((i) => `${i.txHash}#${i.index}`);
  if (new Set(refs).size !== refs.length) {
    throw new OfferRejected('malformed', 'an offer lists the same input twice');
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
  pp: { txFeeFixed: bigint; txFeePerByte: bigint },
  isOwn: (input: TxInput) => boolean = () => false
): VerifiedOffer {
  for (const input of sub.inputs) {
    const ref = `${input.txHash}#${input.index}`;
    if (isOwn(input)) {
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
