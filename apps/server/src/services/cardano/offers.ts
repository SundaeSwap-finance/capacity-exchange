import { FastifyBaseLogger } from 'fastify';
import { Code, ConnectError } from '@connectrpc/connect';
import { LRUCache } from 'lru-cache';
import {
  addValue,
  assembleBatch,
  bytesToHex,
  imbalance,
  OfferRejected,
  type QuoteTerms,
  type RejectionCode,
  receiveOffer,
  type SubTransaction,
  sumValues,
  type TxInput,
  type TxOutput,
  unsignedTx,
  type Value,
  verifyOffer,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import type { Quote } from '../quote.js';
import { type CardanoWalletService, selectFunding, utxoRef } from './wallet.js';

const MAX_TRACKED_OFFERS = 10_000;

/** CIP-0198's offer states, as far as this service follows them; the chain settles the rest. */
export type CardanoOfferState =
  'received' | 'verified' | 'included-in-batch' | 'submitted' | 'rejected';

export interface CardanoOfferStatus {
  offerId: string;
  state: CardanoOfferState;
  batchTxId?: string;
  reason?: { code: RejectionCode; message: string };
}

/**
 * The quoted price an offer pays: the first Cardano native token it leaves at least the quoted
 * amount of. `offered` is the offer's imbalance, positive for what it leaves behind.
 */
export function quoteTerms(quote: Quote, offered: Value): QuoteTerms {
  const paid = quote.prices.find(
    (p) =>
      p.currency.type === 'cardano:native' &&
      (offered.assets.get(p.currency.rawId) ?? 0n) >= BigInt(p.amount),
  );
  if (!paid) {
    throw new OfferRejected(
      'not-interested',
      'offer leaves less than the quoted price in every quoted currency',
    );
  }
  return {
    capacity: quote.amount,
    priceUnit: paid.currency.rawId,
    priceAmount: BigInt(paid.amount),
  };
}

/**
 * Carries Cardano offers: unbalanced sub-transactions that pay a quoted price in tokens for the
 * ADA they need. The server wraps each in a batch it funds, pays the fee for and submits. One
 * batch is built at a time, so each one selects from UTxOs the previous one left unspent.
 */
export class CardanoOfferService {
  private readonly offers = new LRUCache<string, CardanoOfferStatus>({ max: MAX_TRACKED_OFFERS });
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly wallet: CardanoWalletService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Runs the stateless checks and queues the offer; throws `OfferRejected` on a refusal. An
   * offer refused before can be sent again, since a refusal may have been `busy`.
   */
  submit(envelopeHex: string, quote: Quote): CardanoOfferStatus {
    const { sub } = receiveOffer(envelopeHex);
    const existing = this.offers.get(sub.bodyHash);
    if (existing && existing.state !== 'rejected') {
      throw new OfferRejected('duplicate', `offer ${sub.bodyHash} was already received`);
    }
    const status: CardanoOfferStatus = { offerId: sub.bodyHash, state: 'received' };
    this.offers.set(sub.bodyHash, status);
    this.queue = this.queue.then(() => this.carry(sub, quote));
    return { ...status };
  }

  status(offerId: string): CardanoOfferStatus | undefined {
    const status = this.offers.get(offerId);
    return status && { ...status };
  }

  /** Resolves once every queued offer has been carried or refused. */
  async idle(): Promise<void> {
    await this.queue;
  }

  private async carry(sub: SubTransaction, quote: Quote): Promise<void> {
    const offerId = sub.bodyHash;
    try {
      const resolved = await this.wallet.resolve(sub.inputs);
      // Before pricing: an offer whose input is gone would otherwise read as paying nothing.
      const gone = sub.inputs.find((input) => !resolved.has(utxoRef(input)));
      if (gone) {
        throw new OfferRejected('invalidated', `input ${utxoRef(gone)} is no longer unspent`);
      }
      const lookup = (input: TxInput) => resolved.get(utxoRef(input))?.value;
      const own = bytesToHex(this.wallet.address);
      const isOwn = (input: TxInput) => {
        const output = resolved.get(utxoRef(input));
        return output !== undefined && bytesToHex(output.address) === own;
      };
      const offered = imbalance(sub, (i) => lookup(i) ?? { lovelace: 0n, assets: new Map() });
      const verified = verifyOffer(
        sub,
        lookup,
        quoteTerms(quote, offered),
        await this.wallet.feeParams(),
        isOwn,
      );
      this.update(offerId, { state: 'verified' });

      const batch = await this.buildBatch(sub, resolved, verified.imbalance);
      this.update(offerId, { state: 'included-in-batch' });

      const batchTxId = await this.wallet.signAndSubmit(batch);
      this.update(offerId, { state: 'submitted', batchTxId });
    } catch (err) {
      const reason = refusal(err);
      this.logger.warn({ offerId, reason }, 'Refused Cardano offer');
      this.update(offerId, { state: 'rejected', reason });
    }
  }

  /**
   * The batch's change takes the offer's imbalance: the tokens it pays come in, the lovelace it
   * needs goes out.
   */
  private async buildBatch(
    sub: SubTransaction,
    resolved: Map<string, TxOutput>,
    offerImbalance: Value,
  ) {
    const needed = offerImbalance.lovelace < 0n ? -offerImbalance.lovelace : 0n;
    let funding;
    try {
      funding = selectFunding(await this.wallet.utxos(), needed);
    } catch (err) {
      throw new OfferRejected('busy', (err as Error).message);
    }
    const change: TxOutput = {
      address: this.wallet.address,
      value: addValue(sumValues(funding.map((u) => u.output.value)), offerImbalance),
    };
    const draft = unsignedTx(
      funding.map((u) => u.input),
      [change],
    );
    const values = new Map<string, Value>([
      ...funding.map((u) => [utxoRef(u.input), u.output.value] as const),
      ...[...resolved].map(([ref, output]) => [ref, output.value] as const),
    ]);
    const { parent } = assembleBatch({
      draft,
      changeIndex: 0,
      subs: [sub],
      resolve: (input) => values.get(utxoRef(input))!,
      ...(await this.wallet.feeParams()),
      witnessCount: 1,
    });
    return parent;
  }

  private update(offerId: string, change: Partial<CardanoOfferStatus>): void {
    const current = this.offers.get(offerId);
    if (current) {
      this.offers.set(offerId, { ...current, ...change });
    }
  }
}

/** A source refusing the batch is final; anything else may pass, so the caller can retry. */
function refusal(err: unknown): { code: RejectionCode; message: string } {
  if (err instanceof OfferRejected) {
    return { code: err.code, message: err.detail };
  }
  const message = String((err as Error)?.message ?? err);
  if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
    return { code: 'not-interested', message };
  }
  return { code: 'busy', message };
}
