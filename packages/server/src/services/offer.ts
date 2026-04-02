import { FastifyBaseLogger } from 'fastify';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import { PriceService } from './price.js';
import { MetricsService } from './metrics.js';
import { createShieldedCoinInfo } from '@midnight-ntwrk/ledger-v8';

export interface CreateOfferRequest {
  specks: string;
  offerCurrency: string;
  segmentId?: number;
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

  constructor(
    utxoService: UtxoService,
    txService: TxService,
    priceService: PriceService,
    metricsService: MetricsService,
    logger: FastifyBaseLogger,
  ) {
    this.utxoService = utxoService;
    this.txService = txService;
    this.priceService = priceService;
    this.metricsService = metricsService;
    this.logger = logger;
  }

  async createOffer(request: CreateOfferRequest): Promise<CreateOfferResult> {
    const specks = BigInt(request.specks);
    this.logger.debug({ specks: specks.toString() }, 'Processing offer request');

    const result = this.utxoService.lockUtxo(specks);
    if (result.status !== 'ok') {
      return result;
    }

    const lockedInfo = result.value;
    const getPriceResult = this.priceService.getPrice(request.offerCurrency, specks);
    if (getPriceResult.status === 'unsupported-currency') {
      return {
        status: 'unsupported-currency',
        currency: request.offerCurrency,
      };
    }

    // Create Offer
    const coin = createShieldedCoinInfo(request.offerCurrency, getPriceResult.price);
    const expiration = new Date(lockedInfo.expiresAtMillis);
    const tx = await this.txService.createOfferTx(
      coin,
      lockedInfo.spend,
      lockedInfo.syncTime,
      expiration,
      request.segmentId,
    );

    const offer: OfferResponse = {
      offerId: lockedInfo.id,
      offerAmount: getPriceResult.price.toString(),
      offerCurrency: request.offerCurrency,
      serializedTx: Buffer.from(tx.serialize()).toString('hex'),
      expiresAt: expiration.toISOString(),
    };

    this.metricsService.recordDustUsage(specks);
    this.metricsService.recordRevenue(request.offerCurrency, getPriceResult.price);

    return { status: 'ok', offer };
  }
}
