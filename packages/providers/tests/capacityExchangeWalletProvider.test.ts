import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { capacityExchangeWalletProvider } from '../src/wallet/capacityExchangeWalletProvider';
import { CapacityExchangeOfferMismatchError } from '../src/wallet/errors';
import { createMockUnboundTransaction } from './mocks/mockProviders';
import {
  createTestContext,
  createTestConfig,
  setupFetchMock,
  type TestContext,
} from './setup/capacityExchangeWalletProviderSetup';

vi.mock('@sundaeswap/capacity-exchange-client', () => ({
  Configuration: class Configuration {
    basePath: string;
    constructor(config: { basePath?: string }) {
      this.basePath = config?.basePath ?? '';
    }
  },
  DefaultApi: class DefaultApi {
    protected _basePath: string;
    constructor(config: { basePath: string }) {
      this._basePath = config.basePath;
    }
    async apiPricesGet(_params: unknown) {
      const res = await fetch(`${this._basePath}/api/prices`);
      return res.json();
    }
    async apiOffersPost(_params: unknown) {
      const res = await fetch(`${this._basePath}/api/offers`);
      return res.json();
    }
    async apiSponsorPost(_params: unknown) {
      const res = await fetch(`${this._basePath}/api/sponsor`);
      return res.json();
    }
  },
  ResponseError: class ResponseError extends Error {
    constructor(readonly response: Response) {
      super(`ResponseError: ${response.status}`);
    }
  },
}));

vi.mock('@midnight-ntwrk/ledger-v8', async () => {
  const actual = await vi.importActual('@midnight-ntwrk/ledger-v8');
  return {
    ...actual,
    Transaction: {
      deserialize: vi.fn(() => ({
        intents: new Map([[0, { actions: [], dustActions: {} }]]),
        fallibleOffer: {},
        guaranteedOffer: undefined,
        bind: vi.fn(() => {}),
        merge: () => ({
          serialize: () => new Uint8Array([1, 2, 3, 4, 5]),
        }),
      })),
    },
  };
});

describe('capacityExchangeWalletProvider', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
    setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete the full Capacity Exchange flow successfully', async () => {
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const mockTx = createMockUnboundTransaction(50000n);

    const result = await provider.balanceTx(mockTx, new Date(Date.now() + 60000));

    expect(result).toBeDefined();

    expect(ctx.promptForCurrency).toHaveBeenCalledTimes(1);
    expect(ctx.confirmOffer).toHaveBeenCalledTimes(1);
    expect(ctx.mockBalanceSealedTransaction).toHaveBeenCalledTimes(1);
  });

  it('should preserve original WalletProvider methods', () => {
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));

    expect(provider.getCoinPublicKey()).toBe('mock-coin-public-key');
    expect(provider.getEncryptionPublicKey()).toBe('mock-encryption-public-key');
  });

  it('should calculate DUST requirements correctly', async () => {
    const dustRequired = 75000n;
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const mockTx = createMockUnboundTransaction(dustRequired);

    await provider.balanceTx(mockTx, new Date(Date.now() + 60000));

    expect(ctx.promptForCurrency).toHaveBeenCalledWith(expect.anything(), dustRequired, expect.any(String));
    expect(ctx.confirmOffer).toHaveBeenCalledWith(expect.anything(), dustRequired, expect.any(String));
  });

  const QUOTED_PRICE = {
    price: { currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' }, amount: '1000000' },
  };

  function setupMismatchedOfferFetch(overrides: { offerAmount?: string; offerCurrencyId?: string }) {
    const offerAmount = overrides.offerAmount ?? QUOTED_PRICE.price.amount;
    const offerCurrencyId = overrides.offerCurrencyId ?? QUOTED_PRICE.price.currency.id;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/prices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ quoteId: 'test-quote-id', prices: [QUOTED_PRICE.price] }),
        } as Response);
      }
      if (url.includes('/api/offers')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            offerId: 'test-offer-123',
            offerAmount,
            offerCurrency: { id: offerCurrencyId, type: 'midnight:shielded', rawId: offerCurrencyId.split(':')[2] },
            serializedTx: '0102030405060708090a0b0c0d0e0f',
            expiresAt: new Date(Date.now() + 60000),
          }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });
  }

  async function getMismatchError(overrides: {
    offerAmount?: string;
    offerCurrencyId?: string;
  }): Promise<CapacityExchangeOfferMismatchError> {
    setupMismatchedOfferFetch(overrides);
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const error = await provider
      .balanceTx(createMockUnboundTransaction(50000n), new Date(Date.now() + 60000))
      .catch((e) => e);
    expect(error).toBeInstanceOf(CapacityExchangeOfferMismatchError);
    expect(error.quotePrice).toEqual(QUOTED_PRICE);
    return error;
  }

  it('should throw CapacityExchangeOfferMismatchError when offer amount differs from quote', async () => {
    const error = await getMismatchError({ offerAmount: '9999999' });
    expect(error.offer.offerAmount).toBe('9999999');
  });

  it('should throw CapacityExchangeOfferMismatchError when offer currency differs from quote', async () => {
    const error = await getMismatchError({ offerCurrencyId: 'midnight:shielded:BTC' });
    expect(error.offer.offerCurrency.id).toBe('midnight:shielded:BTC');
  });
});
