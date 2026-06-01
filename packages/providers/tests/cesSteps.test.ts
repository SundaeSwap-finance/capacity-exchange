import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { requestCesOffer } from '../src/wallet/cesSteps';
import { CapacityExchangeOfferTransactionInvalidError } from '../src/wallet/errors';
import type { ExchangePrice } from '../src/wallet/types';

// The generated client dist is CJS; mock it so the ESM test runner doesn't choke on it.
vi.mock('@sundaeswap/capacity-exchange-client', () => ({
  Configuration: vi.fn(),
  DefaultApi: vi.fn(),
  ResponseError: class ResponseError extends Error {},
}));

vi.mock('@midnight-ntwrk/ledger-v8', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@midnight-ntwrk/ledger-v8')>();
  return {
    ...actual,
    Transaction: {
      deserialize: vi.fn(),
    },
  };
});

const SERIALIZED_TX = 'deadbeef';

function makeExchangePrice(): ExchangePrice {
  return {
    quoteId: 'test-quote-id',
    price: {
      currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' },
      amount: '1000000',
    },
    exchangeApi: {
      url: 'http://test-ces.example.com',
      api: {
        apiOffersPost: vi.fn().mockResolvedValue({
          offerId: 'test-offer-id',
          offerAmount: '1000000',
          offerCurrency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' },
          serializedTx: SERIALIZED_TX,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      } as any,
    },
  } as unknown as ExchangePrice;
}

// These match the defaults in makeExchangePrice().
const OFFER_RAW_ID = 'ADA';
const OFFER_AMOUNT = 1_000_000n;

function makeValidIntent() {
  return { actions: [] as unknown[], dustActions: {} };
}

function makeValidOfferObj(rawId = OFFER_RAW_ID, amount = OFFER_AMOUNT) {
  return { deltas: new Map([[rawId, -amount]]) };
}

function makeMockTx(
  overrides: {
    intents?: Map<number, { actions: unknown[]; dustActions: unknown }> | null;
    fallibleOffer?: unknown;
    guaranteedOffer?: unknown;
  } = {}
) {
  // fallibleOffer is Map<number, ZswapOffer> on the real type.
  const defaultFallible = new Map([[0, makeValidOfferObj()]]);
  return {
    intents: 'intents' in overrides ? overrides.intents : new Map([[0, makeValidIntent()]]),
    fallibleOffer: 'fallibleOffer' in overrides ? overrides.fallibleOffer : defaultFallible,
    guaranteedOffer: 'guaranteedOffer' in overrides ? overrides.guaranteedOffer : undefined,
  };
}

describe('validateDustTx (via requestCesOffer)', () => {
  beforeEach(() => {
    vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx() as any);
  });

  describe('deserialization', () => {
    it('throws when the serialized tx cannot be deserialized', async () => {
      vi.mocked(Transaction.deserialize).mockImplementation(() => {
        throw new Error('invalid bytes');
      });
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('transaction could not be deserialized');
    });
  });

  describe('valid transactions', () => {
    it('accepts a tx with a fallible offer', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: new Map([[0, makeValidOfferObj()]]), guaranteedOffer: undefined }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).resolves.toBeDefined();
    });

    it('accepts a tx with a guaranteed offer', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: undefined, guaranteedOffer: makeValidOfferObj() }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).resolves.toBeDefined();
    });
  });

  describe('intent count', () => {
    it('throws when intents is absent', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx({ intents: null }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 0');
    });

    it('throws when intents is empty', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx({ intents: new Map() }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 0');
    });

    it('throws when there are multiple intents', async () => {
      const multipleIntents = new Map([
        [0, makeValidIntent()],
        [1, makeValidIntent()],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx({ intents: multipleIntents }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 2');
    });
  });

  describe('intent content', () => {
    it('throws when the intent contains contract calls', async () => {
      const intentWithActions = new Map([[0, { actions: ['some-action'], dustActions: {} }]]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx({ intents: intentWithActions }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('contains unexpected contract calls');
    });

    it('throws when the intent is missing dustActions', async () => {
      const intentWithoutDust = new Map([[0, { actions: [], dustActions: undefined }]]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockTx({ intents: intentWithoutDust }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('intent is missing expected dust actions');
    });
  });

  describe('shielded offer', () => {
    it('throws when neither fallible nor guaranteed offer is present', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: undefined, guaranteedOffer: undefined }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('missing expected shielded offer');
    });

    it('throws when fallible offer map contains more than 1 entry', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({
          fallibleOffer: new Map([
            [0, makeValidOfferObj()],
            [1, makeValidOfferObj()],
          ]),
          guaranteedOffer: undefined,
        }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 fallible offer, got 2');
    });

    it('throws when both fallible and guaranteed offers are present', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({
          fallibleOffer: new Map([[0, makeValidOfferObj()]]),
          guaranteedOffer: makeValidOfferObj(),
        }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(
        'contains both fallible and guaranteed offers'
      );
    });

    it('throws when the offer deltas contain more than 1 token', async () => {
      const offerWithMultipleDeltas = {
        deltas: new Map([
          [OFFER_RAW_ID, -OFFER_AMOUNT],
          ['OTHER_TOKEN', -1n],
        ]),
      };
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: new Map([[0, offerWithMultipleDeltas]]) }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(
        'expected exactly 1 token in offer deltas, got 2'
      );
    });

    it('throws when the offer encodes a different token than agreed', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: new Map([[0, makeValidOfferObj('WRONG_TOKEN')]]) }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('offer does not contain the expected token');
    });

    it('throws when the offer encodes a different amount than agreed', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockTx({ fallibleOffer: new Map([[0, makeValidOfferObj(OFFER_RAW_ID, 1n)]]) }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('shielded offer amount does not match');
    });
  });
});
