import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'crypto';
import adaOfferRoutes from './adaOffers.js';
import { OfferService } from '../services/offer.js';
import { CardanoService } from '../services/cardano.js';
import type { BlockFrostAPI } from '@blockfrost/blockfrost-js';

type TxUtxos = Awaited<ReturnType<BlockFrostAPI['txsUtxos']>>;
import { QuoteService } from '../services/quote.js';
import { useRouteTestApp } from './test-utils.js';

const VALID_TX_HASH = 'a'.repeat(64);

const quoteService = new QuoteService(10, randomBytes(32));

const offerStub = Object.create(OfferService.prototype) as OfferService;
offerStub.createOffer = vi.fn(async (req) => ({
  status: 'ok' as const,
  source: 'built' as const,
  offer: {
    offerId: 'test-id',
    offerAmount: '1000',
    offerCurrency: { id: req.offerCurrency, type: 'midnight:shielded' as const, rawId: 'lovelace' },
    serializedTx: 'deadbeef',
    expiresAt: new Date().toISOString(),
  },
  specksCommitted: 1000n,
  revenueCommitted: { amount: 100n, currency: req.offerCurrency },
}));

const MOCK_UTXO_RESPONSE: TxUtxos = {
  hash: VALID_TX_HASH,
  inputs: [],
  outputs: [
    {
      address: 'addr_test1',
      amount: [{ unit: 'lovelace', quantity: '5000000' }],
      output_index: 0,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
  ],
};

const cardanoStub = Object.create(CardanoService.prototype) as CardanoService;
cardanoStub.verifyUtxoExists = vi.fn(async () => MOCK_UTXO_RESPONSE);

describe('POST /api/ada/offers', () => {
  describe('with cardanoService configured', () => {
    const app = useRouteTestApp({
      decorations: { offerService: offerStub, quoteService, cardanoService: cardanoStub },
      routes: { plugin: adaOfferRoutes, prefix: '/api' },
    });

    function validPayload(quoteId: string) {
      return {
        quoteId,
        offerCurrency: 'midnight:shielded:lovelace',
        utxoTxHash: VALID_TX_HASH,
        senderAddress: 'addr_test1_sender',
        expectedValue: '5000000',
      };
    }

    it('returns 201 when UTXO exists', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(MOCK_UTXO_RESPONSE);
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: validPayload(quoteId),
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().offerId).toBe('test-id');
    });

    it('returns 404 when Cardano UTXO does not exist', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(null);
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: validPayload(quoteId),
      });
      expect(res.statusCode).toBe(404);
    });

    it('calls verifyUtxoExists with txHash, senderAddress, and sentValue', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(MOCK_UTXO_RESPONSE);
      const quoteId = quoteService.createQuote(1000n, []);
      await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: {
          ...validPayload(quoteId),
          senderAddress: 'addr_test1abc',
          expectedValue: '5000000',
        },
      });
      expect(cardanoStub.verifyUtxoExists).toHaveBeenCalledWith({
        txHash: VALID_TX_HASH,
        senderAddress: 'addr_test1abc',
        sentValue: 5000000n,
      });
    });

    it('returns 404 when sender address does not match any input', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(null);
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: { ...validPayload(quoteId), senderAddress: 'addr_test1_unknown' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('passes expectedValue to verifyUtxoExists as bigint', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(MOCK_UTXO_RESPONSE);
      const quoteId = quoteService.createQuote(1000n, []);
      await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: { ...validPayload(quoteId), expectedValue: '5000000' },
      });
      expect(cardanoStub.verifyUtxoExists).toHaveBeenCalledWith(
        expect.objectContaining({ sentValue: 5000000n }),
      );
    });

    it('returns 404 when UTXO value is below the expected minimum', async () => {
      vi.mocked(cardanoStub.verifyUtxoExists).mockResolvedValueOnce(null);
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: { ...validPayload(quoteId), expectedValue: '999999999' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid quoteId', async () => {
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: { ...validPayload('garbage'), quoteId: 'garbage' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when utxoTxHash is wrong length', async () => {
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: { ...validPayload(quoteId), utxoTxHash: 'tooshort' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 410 for expired quote', async () => {
      const quoteId = quoteService.createQuote(1000n, []);
      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 11_000;
      try {
        const res = await app.get().inject({
          method: 'POST',
          url: '/api/ada/offers',
          payload: validPayload(quoteId),
        });
        expect(res.statusCode).toBe(410);
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  describe('without cardanoService configured', () => {
    const app = useRouteTestApp({
      decorations: { offerService: offerStub, quoteService, cardanoService: null },
      routes: { plugin: adaOfferRoutes, prefix: '/api' },
    });

    it('returns 501 when not configured', async () => {
      const quoteId = quoteService.createQuote(1000n, []);
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/ada/offers',
        payload: {
          quoteId,
          offerCurrency: 'midnight:shielded:lovelace',
          utxoTxHash: VALID_TX_HASH,
          senderAddress: 'addr_test1_sender',
          expectedValue: '5000000',
        },
      });
      expect(res.statusCode).toBe(501);
    });
  });
});
