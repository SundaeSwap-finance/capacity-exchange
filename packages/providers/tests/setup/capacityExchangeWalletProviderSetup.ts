import { vi } from 'vitest';
import type {
  CapacityExchangeConfig,
  ExchangePrice,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
  BalanceSealedTransaction,
} from '../../src/wallet/types';
import { createMockWalletProvider } from '../mocks/mockProviders';

export interface TestContext {
  mockWalletProvider: ReturnType<typeof createMockWalletProvider>;
  mockBalanceSealedTransaction: BalanceSealedTransaction;
  promptForCurrency: (prices: ExchangePrice[], dustRequired: bigint) => Promise<CurrencySelectionResult>;
  confirmOffer: (offer: Offer, dustRequired: bigint) => Promise<OfferConfirmationResult>;
}

export function createTestContext(): TestContext {
  const mockWalletProvider = createMockWalletProvider();
  return {
    mockWalletProvider,
    mockBalanceSealedTransaction: vi.fn().mockResolvedValue({} as any),
    promptForCurrency: vi.fn().mockImplementation((exchangePrices: ExchangePrice[]) => {
      const selectedPrice = exchangePrices.find((ep) => ep.price.currency === 'ADA') || exchangePrices[0];
      return Promise.resolve({ status: 'selected', exchangePrice: selectedPrice });
    }),
    confirmOffer: vi.fn().mockResolvedValue({ status: 'confirmed' }),
  };
}

export function setupFetchMock(): void {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('graphql')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            block: {
              ledgerParameters: '0a0b0c0d0e0f1011121314151617181920',
            },
          },
        }),
      } as Response);
    }

    if (url.includes('/api/prices')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          quoteId: 'test-quote-id',
          prices: [
            { currency: 'ADA', amount: '1000000' },
            { currency: 'BTC', amount: '50000' },
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
          offerCurrency: 'ADA',
          serializedTx: '0102030405060708090a0b0c0d0e0f',
          expiresAt: new Date(Date.now() + 60000),
        }),
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });
}

export function createTestConfig(ctx: TestContext): CapacityExchangeConfig {
  return {
    coinPublicKey: ctx.mockWalletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.mockWalletProvider.getEncryptionPublicKey(),
    balanceSealedTransaction: ctx.mockBalanceSealedTransaction,
    indexerUrl: 'http://localhost:8080/graphql',
    capacityExchangeUrls: ['http://localhost:3000'],
    promptForCurrency: ctx.promptForCurrency,
    confirmOffer: ctx.confirmOffer,
    margin: 3,
  };
}
