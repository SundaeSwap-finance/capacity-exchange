import { FastifyBaseLogger } from 'fastify';
import { LRUCache } from 'lru-cache';
import {
  assembleBatch,
  decodeEnvelope,
  decodeSubTransactionBytes,
  FORBIDDEN_SUB_TX_KEYS,
  hexToBytes,
  imbalance,
  bytesToHex,
  type SubTransaction,
  type TxInput,
  type TxOutput,
  unsignedTx,
  type Value,
  verifyWitnesses,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { type CardanoWalletService, selectAdaOnly, utxoRef } from './wallet.js';

/**
 * The most lovelace one offer may take from its batch. ADA-only offers pay nothing for it, so
 * this bounds what the server gives away per offer.
 */
const MAX_SPONSORED_LOVELACE = 5_000_000n;
const MAX_TRACKED_OFFERS = 10_000;

/** CIP-0198's offer states, as far as this service follows them; the chain settles the rest. */
export type CardanoOfferState =
  'received' | 'verified' | 'included-in-batch' | 'submitted' | 'rejected';

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

export interface CardanoOfferStatus {
  offerId: string;
  state: CardanoOfferState;
  batchTxId?: string;
  reason?: { code: RejectionCode; message: string };
}

export class OfferRejected extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * CIP-0198's stateless checks: a refusal here answers the request instead of a `202`.
 * CIP-0198 also requires a finite validity upper bound, which this service does not enforce.
 */
export function receiveOffer(envelopeHex: string): SubTransaction {
  let subBytes: Uint8Array;
  try {
    subBytes = decodeEnvelope(hexToBytes(envelopeHex));
  } catch (err) {
    const message = (err as Error).message;
    throw new OfferRejected(
      /Unsupported/.test(message) ? 'unsupported-version' : 'malformed',
      message,
    );
  }
  let sub: SubTransaction;
  try {
    sub = decodeSubTransactionBytes(subBytes);
    if (sub.inputs.length === 0) {
      throw new Error('an offer needs at least one spend input');
    }
    verifyWitnesses(sub);
  } catch (err) {
    throw new OfferRejected('malformed', (err as Error).message);
  }
  for (const [key, label] of FORBIDDEN_SUB_TX_KEYS) {
    if (sub.body.has(key)) {
      throw new OfferRejected(
        'not-interested',
        `this service does not carry offers containing ${label}`,
      );
    }
  }
  return sub;
}

/**
 * The lovelace an ADA-only offer needs from its batch, which is negative when it leaves some
 * behind. Tokens are refused: Dolos rejects any Dijkstra transaction that moves one.
 */
export function lovelaceNeeded(
  sub: SubTransaction,
  resolved: Map<string, TxOutput>,
  ownAddress: Uint8Array,
): bigint {
  const own = bytesToHex(ownAddress);
  const values = new Map<string, Value>();
  for (const input of sub.inputs) {
    const output = resolved.get(utxoRef(input));
    if (!output) {
      throw new OfferRejected('invalidated', `input ${utxoRef(input)} is not unspent`);
    }
    if (bytesToHex(output.address) === own) {
      throw new OfferRejected(
        'not-interested',
        `offer spends ${utxoRef(input)}, which belongs to this service`,
      );
    }
    values.set(utxoRef(input), output.value);
  }
  if ([...values.values(), ...sub.outputs.map((o) => o.value)].some((v) => v.assets.size > 0)) {
    throw new OfferRejected(
      'not-interested',
      'this service only carries offers that move ADA alone',
    );
  }
  const needed = -imbalance(sub, (i: TxInput) => values.get(utxoRef(i))!).lovelace;
  if (needed > MAX_SPONSORED_LOVELACE) {
    throw new OfferRejected(
      'over-budget',
      `offer needs ${needed} lovelace; this service gives at most ${MAX_SPONSORED_LOVELACE} per offer`,
    );
  }
  return needed;
}

/**
 * Carries Cardano offers: unbalanced sub-transactions that the server wraps in a batch it
 * funds, pays the fee for and submits. One batch is built at a time, so each one selects
 * from UTxOs the previous one left unspent.
 */
export class CardanoOfferService {
  private readonly offers = new LRUCache<string, CardanoOfferStatus>({ max: MAX_TRACKED_OFFERS });
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly wallet: CardanoWalletService,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /** Runs the stateless checks and queues the offer; throws `OfferRejected` on a refusal. */
  submit(envelopeHex: string): CardanoOfferStatus {
    const sub = receiveOffer(envelopeHex);
    if (this.offers.has(sub.bodyHash)) {
      throw new OfferRejected('duplicate', `offer ${sub.bodyHash} was already received`);
    }
    const status: CardanoOfferStatus = { offerId: sub.bodyHash, state: 'received' };
    this.offers.set(sub.bodyHash, status);
    this.queue = this.queue.then(() => this.carry(sub));
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

  private async carry(sub: SubTransaction): Promise<void> {
    const offerId = sub.bodyHash;
    try {
      const resolved = await this.wallet.resolve(sub.inputs);
      const needed = lovelaceNeeded(sub, resolved, this.wallet.address);
      this.update(offerId, { state: 'verified' });

      const batch = await this.buildBatch(sub, resolved, needed);
      this.update(offerId, { state: 'included-in-batch' });

      const batchTxId = await this.wallet.signAndSubmit(batch);
      this.update(offerId, { state: 'submitted', batchTxId });
    } catch (err) {
      const reason =
        err instanceof OfferRejected
          ? { code: err.code, message: err.message }
          : { code: 'not-interested' as const, message: String((err as Error).message ?? err) };
      this.logger.warn({ offerId, reason }, 'Refused Cardano offer');
      this.update(offerId, { state: 'rejected', reason });
    }
  }

  private async buildBatch(sub: SubTransaction, resolved: Map<string, TxOutput>, needed: bigint) {
    let funding;
    try {
      funding = selectAdaOnly(await this.wallet.utxos(), needed > 0n ? needed : 0n);
    } catch (err) {
      throw new OfferRejected('busy', (err as Error).message);
    }
    const funded = funding.reduce((total, u) => total + u.output.value.lovelace, 0n);
    const change: TxOutput = {
      address: this.wallet.address,
      value: { lovelace: funded - needed, assets: new Map() },
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
