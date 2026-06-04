import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { requestCesOffer } from '../src/wallet/cesSteps';
import { CapacityExchangeOfferTransactionInvalidError } from '../src/wallet/errors';
import type { ExchangePrice } from '../src/wallet/types';

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
const OFFER_RAW_ID = 'ADA';
const OFFER_AMOUNT = 1_000_000n;

// ── Shielded helpers ─────────────────────────────────────────────────────────

function makeExchangePrice(): ExchangePrice {
  return {
    quoteId: 'test-quote-id',
    price: {
      currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: OFFER_RAW_ID },
      amount: String(OFFER_AMOUNT),
    },
    exchangeApi: {
      url: 'http://test-ces.example.com',
      api: {
        apiOffersPost: vi.fn().mockResolvedValue({
          offerId: 'test-offer-id',
          offerAmount: String(OFFER_AMOUNT),
          offerCurrency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: OFFER_RAW_ID },
          serializedTx: SERIALIZED_TX,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      } as any,
    },
  } as unknown as ExchangePrice;
}

function makeValidShieldedIntent() {
  return { actions: [] as unknown[], dustActions: {} as unknown };
}

function makeValidOfferObj(rawId = OFFER_RAW_ID, amount = OFFER_AMOUNT) {
  return { deltas: new Map([[rawId, -amount]]) };
}

function makeMockShieldedTx(
  overrides: {
    intents?: Map<number, unknown> | null;
    fallibleOffer?: unknown;
    guaranteedOffer?: unknown;
  } = {}
) {
  const result: Record<string, unknown> = {
    intents: 'intents' in overrides ? overrides.intents : new Map([[0, makeValidShieldedIntent()]]),
    fallibleOffer: 'fallibleOffer' in overrides ? overrides.fallibleOffer : undefined,
    guaranteedOffer: 'guaranteedOffer' in overrides ? overrides.guaranteedOffer : makeValidOfferObj(),
  };
  return result;
}

// ── Unshielded helpers ───────────────────────────────────────────────────────

function makeUnshieldedExchangePrice(): ExchangePrice {
  const currency = { id: 'midnight:unshielded:ADA', type: 'midnight:unshielded', rawId: OFFER_RAW_ID };
  return {
    quoteId: 'test-quote-id',
    price: { currency, amount: String(OFFER_AMOUNT) },
    exchangeApi: {
      url: 'http://test-ces.example.com',
      api: {
        apiOffersPost: vi.fn().mockResolvedValue({
          offerId: 'test-offer-id',
          offerAmount: String(OFFER_AMOUNT),
          offerCurrency: currency,
          serializedTx: SERIALIZED_TX,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      } as any,
    },
  } as unknown as ExchangePrice;
}

function makeValidUnshieldedIntent(rawId = OFFER_RAW_ID, amount = OFFER_AMOUNT) {
  return {
    actions: [] as unknown[],
    dustActions: {} as unknown,
    fallibleUnshieldedOffer: undefined as unknown,
    guaranteedUnshieldedOffer: { outputs: [{ type: rawId, value: amount, owner: 'some-address' }] } as unknown,
  };
}

function makeMockUnshieldedTx(
  overrides: {
    intents?: Map<number, unknown> | null;
  } = {}
) {
  const result: Record<string, unknown> = {
    intents: 'intents' in overrides ? overrides.intents : new Map([[0, makeValidUnshieldedIntent()]]),
    fallibleOffer: undefined,
    guaranteedOffer: undefined,
  };
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('validateOfferTx (via requestCesOffer)', () => {
  describe('deserialization', () => {
    it('throws when the serialized tx cannot be deserialized', async () => {
      vi.mocked(Transaction.deserialize).mockImplementation(() => {
        throw new Error('invalid bytes');
      });
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('transaction could not be deserialized');
    });
  });

  describe('intent count', () => {
    beforeEach(() => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx() as any);
    });

    it('throws when intents is absent', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ intents: null }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 0');
    });

    it('throws when intents is empty', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ intents: new Map() }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 0');
    });

    it('throws when there are multiple intents', async () => {
      const multipleIntents = new Map([
        [0, makeValidShieldedIntent()],
        [1, makeValidShieldedIntent()],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ intents: multipleIntents }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('expected exactly 1 intent, got 2');
    });
  });

  describe('intent content', () => {
    it('throws when the intent contains contract calls', async () => {
      const intentWithActions = new Map([[0, { actions: ['some-action'], dustActions: {} }]]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ intents: intentWithActions }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('contains unexpected contract calls');
    });

    it('throws when the intent is missing dustActions', async () => {
      const intentWithoutDust = new Map([[0, { actions: [], dustActions: undefined }]]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ intents: intentWithoutDust }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('intent is missing expected dust actions');
    });
  });

  describe('shielded offer', () => {
    beforeEach(() => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx() as any);
    });

    it('accepts a tx with a valid guaranteed shielded offer', async () => {
      await expect(requestCesOffer(makeExchangePrice())).resolves.toBeDefined();
    });

    it('throws when a fallible offer is present', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockShieldedTx({ fallibleOffer: new Map([[0, makeValidOfferObj()]]), guaranteedOffer: undefined }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(
        'contains a fallible offer; a guaranteed shielded offer is required'
      );
    });

    it('throws when no guaranteed offer is present', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockShieldedTx({ guaranteedOffer: undefined }) as any);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('missing expected guaranteed shielded offer');
    });

    it('throws when the offer deltas contain more than 1 token', async () => {
      const offerWithMultipleDeltas = {
        deltas: new Map([
          [OFFER_RAW_ID, -OFFER_AMOUNT],
          ['OTHER_TOKEN', -1n],
        ]),
      };
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockShieldedTx({ guaranteedOffer: offerWithMultipleDeltas }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(
        'expected exactly 1 token in shielded offer deltas, got 2'
      );
    });

    it('throws when the offer encodes a different token than agreed', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockShieldedTx({ guaranteedOffer: makeValidOfferObj('WRONG_TOKEN') }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('offer does not contain the expected token');
    });

    it('throws when the offer encodes a different amount than agreed', async () => {
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockShieldedTx({ guaranteedOffer: makeValidOfferObj(OFFER_RAW_ID, 1n) }) as any
      );
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow(CapacityExchangeOfferTransactionInvalidError);
      await expect(requestCesOffer(makeExchangePrice())).rejects.toThrow('shielded offer amount does not match');
    });
  });

  describe('unshielded offer', () => {
    beforeEach(() => {
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockUnshieldedTx() as any);
    });

    it('accepts a tx with a valid guaranteed unshielded offer', async () => {
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).resolves.toBeDefined();
    });

    it('throws when a fallible unshielded offer is present', async () => {
      const intentWithFallible = new Map([
        [
          0,
          {
            ...makeValidUnshieldedIntent(),
            fallibleUnshieldedOffer: { outputs: [] },
            guaranteedUnshieldedOffer: undefined,
          },
        ],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(makeMockUnshieldedTx({ intents: intentWithFallible }) as any);
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        CapacityExchangeOfferTransactionInvalidError
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        'contains a fallible unshielded offer; a guaranteed unshielded offer is required'
      );
    });

    it('throws when no guaranteed unshielded offer is present', async () => {
      const intentWithoutGuaranteed = new Map([
        [
          0,
          {
            ...makeValidUnshieldedIntent(),
            guaranteedUnshieldedOffer: undefined,
          },
        ],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockUnshieldedTx({ intents: intentWithoutGuaranteed }) as any
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        CapacityExchangeOfferTransactionInvalidError
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        'missing expected guaranteed unshielded offer'
      );
    });

    it('throws when the offer contains more than 1 output', async () => {
      const intentWithMultipleOutputs = new Map([
        [
          0,
          {
            ...makeValidUnshieldedIntent(),
            guaranteedUnshieldedOffer: {
              outputs: [
                { type: OFFER_RAW_ID, value: OFFER_AMOUNT, owner: 'addr-1' },
                { type: OFFER_RAW_ID, value: OFFER_AMOUNT, owner: 'addr-2' },
              ],
            },
          },
        ],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockUnshieldedTx({ intents: intentWithMultipleOutputs }) as any
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        CapacityExchangeOfferTransactionInvalidError
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        'expected exactly 1 unshielded output, got 2'
      );
    });

    it('throws when the output encodes a different token than agreed', async () => {
      const intentWithWrongToken = new Map([
        [
          0,
          {
            ...makeValidUnshieldedIntent('WRONG_TOKEN'),
          },
        ],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockUnshieldedTx({ intents: intentWithWrongToken }) as any
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        CapacityExchangeOfferTransactionInvalidError
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        'unshielded offer does not contain the expected token'
      );
    });

    it('throws when the output encodes a different amount than agreed', async () => {
      const intentWithWrongAmount = new Map([
        [
          0,
          {
            ...makeValidUnshieldedIntent(OFFER_RAW_ID, 1n),
          },
        ],
      ]);
      vi.mocked(Transaction.deserialize).mockReturnValue(
        makeMockUnshieldedTx({ intents: intentWithWrongAmount }) as any
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        CapacityExchangeOfferTransactionInvalidError
      );
      await expect(requestCesOffer(makeUnshieldedExchangePrice())).rejects.toThrow(
        'unshielded offer amount does not match'
      );
    });
  });
});
