import { FastifyBaseLogger } from 'fastify';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import { PriceService } from './price.js';
import { MetricsService } from './metrics.js';
import { TtlCache } from '../utils/ttl-cache.js';
import { createShieldedCoinInfo } from '@midnight-ntwrk/ledger-v8';

export interface CreateOfferRequest {
  quoteId: string;
  specks: bigint;
  offerCurrency: string;
}

export interface OfferResponse {
  offerId: string;
  offerAmount: string;
  offerCurrency: string;
  serializedTx: string;
  expiresAt: string;
}

export type CreateOfferResult =
  | { status: 'ok'; offer: OfferResponse }
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
  private readonly cache: TtlCache<OfferResponse>;
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
    this.cache = new TtlCache(offerTtlSeconds, 'offers', logger);
  }

  stop(): void {
    this.cache.stop();
  }

  /** Checks for a cached offer and returns it if present. Then checks for an in-flight
   * offer (still being built or proven) and returns that if present. Otherwise,
   * kicks-off a new build.
  */
  async createOffer(request: CreateOfferRequest): Promise<CreateOfferResult> {
    const cacheKey = `${request.quoteId}:${request.offerCurrency}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.info({ cacheKey, offerId: cached.offerId }, 'Returning cached offer');
      return { status: 'ok', offer: cached };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      this.logger.info({ cacheKey }, 'Coalescing with in-flight offer build');
      return existing;
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
  private async buildOffer(
    request: CreateOfferRequest,
    cacheKey: string,
  ): Promise<CreateOfferResult> {
    this.logger.debug({ cacheKey, specks: request.specks.toString(), offerCurrency: request.offerCurrency }, 'Building offer');

    const getPriceResult = this.priceService.getPrice(request.offerCurrency, request.specks);
    if (getPriceResult.status === 'unsupported-currency') {
      return { status: 'unsupported-currency', currency: request.offerCurrency };
    }

    const lockResult = this.utxoService.lockUtxo(request.specks);
    if (lockResult.status !== 'ok') {
      return lockResult;
    }

    const lockedInfo = lockResult.value;

    try {
      const coin = createShieldedCoinInfo(request.offerCurrency, getPriceResult.price);
      const expiration = new Date(lockedInfo.expiresAtMillis);
      const tx = await this.txService.createOfferTx(coin, lockedInfo.spend, expiration);

      const offer: OfferResponse = {
        offerId: lockedInfo.id,
        offerAmount: getPriceResult.price.toString(),
        offerCurrency: request.offerCurrency,
        serializedTx: Buffer.from(tx.serialize()).toString('hex'),
        expiresAt: expiration.toISOString(),
      };

      this.cache.set(cacheKey, offer, lockedInfo.expiresAtMillis);
      this.logger.info({ cacheKey, offerId: lockedInfo.id, expiresAt: expiration.toISOString() }, 'Offer built and cached');

      this.metricsService.recordDustUsage(request.specks);
      this.metricsService.recordRevenue(request.offerCurrency, getPriceResult.price);

      return { status: 'ok', offer };
    } catch (err) {
      this.utxoService.unlock(lockedInfo.id);
      throw err;
    }
  }
}
