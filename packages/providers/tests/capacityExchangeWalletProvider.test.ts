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

vi.mock('@midnight-ntwrk/ledger-v8', async () => {
  const actual = await vi.importActual('@midnight-ntwrk/ledger-v8');
  return {
    ...actual,
    Transaction: {
      deserialize: vi.fn(() => ({
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

  it('should throw CapacityExchangeOfferMismatchError when offer amount differs from quote', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/prices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            quoteId: 'test-quote-id',
            prices: [
              { currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' }, amount: '1000000' },
            ],
          }),
        } as Response);
      }

      if (url.includes('/api/offers')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            offerId: 'test-offer-123',
            offerAmount: '9999999',
            offerCurrency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' },
            serializedTx: '0102030405060708090a0b0c0d0e0f',
            expiresAt: new Date(Date.now() + 60000),
          }),
        } as Response);
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });

    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const mockTx = createMockUnboundTransaction(50000n);

    await expect(provider.balanceTx(mockTx, new Date(Date.now() + 60000))).rejects.toThrow(
      CapacityExchangeOfferMismatchError
    );
  });

  it('should throw CapacityExchangeOfferMismatchError when offer currency differs from quote', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/prices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            quoteId: 'test-quote-id',
            prices: [
              { currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' }, amount: '1000000' },
            ],
          }),
        } as Response);
      }

      if (url.includes('/api/offers')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            offerId: 'test-offer-123',
            offerAmount: '1000000',
            offerCurrency: { id: 'midnight:shielded:BTC', type: 'midnight:shielded', rawId: 'BTC' },
            serializedTx: '0102030405060708090a0b0c0d0e0f',
            expiresAt: new Date(Date.now() + 60000),
          }),
        } as Response);
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });

    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const mockTx = createMockUnboundTransaction(50000n);

    await expect(provider.balanceTx(mockTx, new Date(Date.now() + 60000))).rejects.toThrow(
      CapacityExchangeOfferMismatchError
    );
  });
});
