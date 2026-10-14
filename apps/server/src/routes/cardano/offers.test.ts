import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'crypto';
import { OfferRejected } from '@sundaeswap/capacity-exchange-cardano-tx';
import cardanoOfferRoutes from './offers.js';
import { CardanoOfferService } from '../../services/cardano/offers.js';
import { QuoteService } from '../../services/quote.js';
import { useRouteTestApp } from '../test-utils.js';

const secret = randomBytes(32);
const quoteService = new QuoteService(60, secret);
const expiredQuotes = new QuoteService(-1, secret);
const OFFER_ID = 'ab'.repeat(32);

const offerStub = Object.create(CardanoOfferService.prototype) as CardanoOfferService;
offerStub.submit = vi.fn((envelope: string) => {
  if (envelope === 'dd') {
    throw new OfferRejected('duplicate', 'already received');
  }
  return { offerId: OFFER_ID, state: 'received' as const };
});
offerStub.status = vi.fn((offerId: string) =>
  offerId === OFFER_ID
    ? { offerId, state: 'submitted' as const, batchTxId: 'cd'.repeat(32) }
    : undefined,
);

function post(app: ReturnType<typeof useRouteTestApp>, envelope: string, quoteId: string) {
  return app
    .get()
    .inject({ method: 'POST', url: '/api/cardano/offers', payload: { envelope, quoteId } });
}

describe('/api/cardano/offers', () => {
  describe('with offers configured', () => {
    const app = useRouteTestApp({
      decorations: { cardanoOfferService: offerStub, quoteService },
      routes: { plugin: cardanoOfferRoutes, prefix: '/api/cardano' },
    });

    it('accepts an offer with an ADA quote for verification', async () => {
      const response = await post(app, 'ab', quoteService.createQuote('ADA', 1_000_000n, []));
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({ offerId: OFFER_ID, state: 'received' });
    });

    it('refuses a quote this service did not issue as malformed', async () => {
      const response = await post(app, 'ab', 'not-a-quote');
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('malformed');
    });

    it('refuses an expired quote', async () => {
      const response = await post(app, 'ab', expiredQuotes.createQuote('ADA', 1_000_000n, []));
      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe('expired');
    });

    it('refuses a quote for another capacity asset', async () => {
      const response = await post(app, 'ab', quoteService.createQuote('DUST', 1_000_000n, []));
      expect(response.statusCode).toBe(400);
    });

    it('answers a duplicate with 409 and its CIP-0198 code', async () => {
      const response = await post(app, 'dd', quoteService.createQuote('ADA', 1_000_000n, []));
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ code: 'duplicate', message: 'already received' });
    });

    it("reports a known offer's state and 404s an unknown one", async () => {
      const known = await app
        .get()
        .inject({ method: 'GET', url: `/api/cardano/offers/${OFFER_ID}` });
      expect(known.json()).toMatchObject({ state: 'submitted' });
      const unknown = await app
        .get()
        .inject({ method: 'GET', url: `/api/cardano/offers/${'00'.repeat(32)}` });
      expect(unknown.statusCode).toBe(404);
    });
  });

  describe('without offers configured', () => {
    const app = useRouteTestApp({
      decorations: { cardanoOfferService: null, quoteService },
      routes: { plugin: cardanoOfferRoutes, prefix: '/api/cardano' },
    });

    it('answers 501', async () => {
      const response = await post(app, 'ab', quoteService.createQuote('ADA', 1_000_000n, []));
      expect(response.statusCode).toBe(501);
    });
  });
});
