import { FastifyBaseLogger } from 'fastify';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import { Currency, PriceService } from './price.js';
import { MetricsService } from './metrics.js';
import { LRUCache } from 'lru-cache';
import { createShieldedCoinInfo } from '@midnight-ntwrk/ledger-v8';
import { recordDuration, recordCounters } from '../decorators/record-metrics.js';

export interface CreateOfferRequest {
  quoteId: string;
  specks: bigint;
  offerCurrency: string;
}

export interface OfferResponse {
  offerId: string;
  offerAmount: string;
  offerCurrency: Currency;
  serializedTx: string;
  expiresAt: string;
}

export type CreateOfferResult =
  | {
      status: 'ok';
      source: 'built';
      offer: OfferResponse;
      specksCommitted: bigint;
      revenueCommitted: { amount: bigint; currency: string };
    }
  | { status: 'ok'; source: 'cached' | 'coalesced'; offer: OfferResponse }
  | { status: 'unsupported-currency'; currency: string }
  | WalletUnavailableResult;

/**
 * Manages the exchange offer logic.
 */
export class OfferService {
  private readonly utxoService: UtxoService;
  private readonly txService: TxService;
  private readonly priceService: PriceService;
  private readonly metricsService: MetricsService;
  private readonly logger: FastifyBaseLogger;
  private readonly cache: LRUCache<string, OfferResponse>;
  private readonly inflight = new Map<string, Promise<CreateOfferResult>>();

  constructor(
    utxoService: UtxoService,
    txService: TxService,
    priceService: PriceService,
    metricsService: MetricsService,
    offerTtlSeconds: number,
    logger: FastifyBaseLogger,
  ) {
    this.utxoService = utxoService;
    this.txService = txService;
    this.priceService = priceService;
    this.metricsService = metricsService;
    this.logger = logger;
    this.cache = new LRUCache<string, OfferResponse>({
      ttl: offerTtlSeconds * 1000,
      ttlAutopurge: true,
    });
  }

  /** Checks for a cached offer and returns it if present. Then checks for an in-flight
   * offer (still being built or proven) and returns that if present. Otherwise,
   * kicks-off a new build.
   */
  @recordCounters({
    name: 'ces.offer.result',
    description: 'Offer results by status',
    extract: (result: CreateOfferResult) => {
      const attrs: Record<string, string> = { status: result.status };
      if (result.status === 'ok') {
        attrs.source = result.source;
      }
      return { value: 1, attributes: attrs };
    },
  })
  async createOffer(request: CreateOfferRequest): Promise<CreateOfferResult> {
    const cacheKey = `${request.quoteId}:${request.offerCurrency}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.info({ cacheKey, offerId: cached.offerId }, 'Returning cached offer');
      return { status: 'ok', source: 'cached', offer: cached };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      this.logger.info({ cacheKey }, 'Coalescing with in-flight offer build');
      const result = await existing;
      if (result.status === 'ok') {
        return { status: 'ok', source: 'coalesced', offer: result.offer };
      }
      return result;
    }

    const buildPromise = this.buildOffer(request, cacheKey);
    this.inflight.set(cacheKey, buildPromise);
    try {
      return await buildPromise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /** Locks a UTXO, calculates the price, proves the tx, and caches the result. */
  @recordDuration('ces.offer.build_duration_ms', 'Offer build duration')
  @recordCounters(
    {
      name: 'ces.dust.committed_specks',
      description: 'Specks committed via offers',
      extract: (result: CreateOfferResult) =>
        result.status === 'ok' && result.source === 'built'
          ? { value: Number(result.specksCommitted) }
          : null,
    },
    {
      name: 'ces.revenue.committed',
      description: 'Committed revenue by currency',
      extract: (result: CreateOfferResult) =>
        result.status === 'ok' && result.source === 'built'
          ? {
              value: Number(result.revenueCommitted.amount),
              attributes: { currency: result.revenueCommitted.currency },
            }
          : null,
    },
  )
  private async buildOffer(
    request: CreateOfferRequest,
    cacheKey: string,
  ): Promise<CreateOfferResult> {
    this.logger.debug(
      { cacheKey, specks: request.specks.toString(), offerCurrency: request.offerCurrency },
      'Building offer',
    );

    const getPriceResult = this.priceService.getPrice(request.offerCurrency, request.specks);
    if (
      getPriceResult.status === 'unsupported-currency' ||
      getPriceResult.currency.type !== 'shielded'
    ) {
      return { status: 'unsupported-currency', currency: request.offerCurrency };
    }

    const lockResult = this.utxoService.lockUtxo(request.specks);
    if (lockResult.status !== 'ok') {
      return lockResult;
    }
    const lockedInfo = lockResult.value;

    try {
      const coin = createShieldedCoinInfo(getPriceResult.currency.identifier, getPriceResult.price);
      const expiration = new Date(lockedInfo.expiresAtMillis);
      const unboundTx = await this.txService.createOfferTx(
        coin,
        lockedInfo.spend,
        lockedInfo.syncTime,
        expiration,
      );
      const tx = unboundTx.bind();

      const offer: OfferResponse = {
        offerId: lockedInfo.id,
        offerAmount: getPriceResult.price.toString(),
        offerCurrency: getPriceResult.currency,
        serializedTx: Buffer.from(tx.serialize()).toString('hex'),
        expiresAt: expiration.toISOString(),
      };

      this.cache.set(cacheKey, offer);
      this.logger.info(
        { cacheKey, offerId: lockedInfo.id, expiresAt: expiration.toISOString() },
        'Offer built and cached',
      );

      this.metricsService.recordDustUsage(request.specks);
      this.metricsService.recordRevenue(request.offerCurrency, getPriceResult.price);

      return {
        status: 'ok',
        source: 'built' as const,
        offer,
        specksCommitted: request.specks,
        revenueCommitted: { amount: getPriceResult.price, currency: request.offerCurrency },
      };
    } catch (err) {
      this.utxoService.unlock(lockedInfo.id);
      throw err;
    }
  }
}
