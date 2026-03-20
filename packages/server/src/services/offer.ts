import { FastifyBaseLogger } from 'fastify';
import { UtxoService, type WalletUnavailableResult } from './utxo.js';
import { TxService } from './tx.js';
import { PriceService } from './price.js';
import { createShieldedCoinInfo } from '@midnight-ntwrk/ledger-v7';

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
  private readonly logger: FastifyBaseLogger;

  constructor(
    utxoService: UtxoService,
    txService: TxService,
    priceService: PriceService,
    logger: FastifyBaseLogger,
  ) {
    this.utxoService = utxoService;
    this.txService = txService;
    this.priceService = priceService;
    this.logger = logger;
  }

  async createOffer(request: CreateOfferRequest): Promise<CreateOfferResult> {
    const specks = BigInt(request.specks);
    this.logger.debug({ specks: specks.toString() }, 'Processing offer request');

    const result = this.utxoService.lockUtxo(specks);
    if (result.status !== 'ok') {
      this.logger.info({ status: result.status }, 'lockUtxo failed');
      return result;
    }

    const lockedInfo = result.value;
    this.logger.info({ id: lockedInfo.id, expiresAtMillis: lockedInfo.expiresAtMillis }, 'Locked UTXO');
    const getPriceResult = this.priceService.getPrice(request.offerCurrency, specks);
    if (getPriceResult.status === 'unsupported-currency') {
      return {
        status: 'unsupported-currency',
        currency: request.offerCurrency,
      };
    }

    this.logger.info({ price: getPriceResult.price.toString(), currency: request.offerCurrency }, 'Price calculated');

    // Create Offer
    const coin = createShieldedCoinInfo(request.offerCurrency, getPriceResult.price);
    const expiration = new Date(lockedInfo.expiresAtMillis);
    const tx = await this.txService.createOfferTx(
      coin,
      lockedInfo.spend,
      expiration,
      request.segmentId,
    );

    this.logger.info({ txBytes: tx.serialize().length }, 'Offer tx created');
    this.logger.info({ txDump: tx.toString() }, 'Offer tx details');

    const offer: OfferResponse = {
      offerId: lockedInfo.id,
      offerAmount: getPriceResult.price.toString(),
      offerCurrency: request.offerCurrency,
      serializedTx: Buffer.from(tx.serialize()).toString('hex'),
      expiresAt: expiration.toISOString(),
    };

    return { status: 'ok', offer };
  }
}
