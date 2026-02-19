import { FastifyBaseLogger } from 'fastify';
import { UtxoService } from './utxo.js';
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
  | { status: 'insufficient-funds'; requested: bigint }
  | { status: 'wallet-syncing' }
  | { status: 'wallet-sync-failed'; error: string }
  | { status: 'unsupported-currency'; currency: string }
  | { status: 'illegal-state'; error: string };

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

    switch (result.status) {
      case 'insufficient-funds':
        return { status: 'insufficient-funds', requested: result.requested };
      case 'wallet-syncing':
        return { status: 'wallet-syncing' };
      case 'wallet-sync-failed':
        return { status: 'wallet-sync-failed', error: result.error };
      case 'illegal-state':
        return { status: 'illegal-state', error: result.error };
      case 'ok': {
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
        const tx = await this.txService.createFundingTx(
          coin,
          lockedInfo.spend,
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

        return { status: 'ok', offer };
      }
    }
  }
}
