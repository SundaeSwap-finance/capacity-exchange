import { vi } from 'vitest';
import type {
  CapacityExchangeConfig,
  Price,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
} from '../../src/wallet/types';
import {
  createMockWalletProvider,
  createMockProofProvider,
  createMockZKConfigProvider,
  createMockConnectedAPI,
} from '../mocks/mockProviders';

export interface TestContext {
  mockWalletProvider: ReturnType<typeof createMockWalletProvider>;
  mockConnectedAPI: ReturnType<typeof createMockConnectedAPI>;
  mockProofProvider: ReturnType<typeof createMockProofProvider>;
  mockZKConfigProvider: ReturnType<typeof createMockZKConfigProvider>;
  promptForCurrency: (prices: Price[], dustRequired: bigint) => Promise<CurrencySelectionResult>;
  confirmOffer: (offer: Offer, dustRequired: bigint) => Promise<OfferConfirmationResult>;
}

export function createTestContext(): TestContext {
  return {
    mockWalletProvider: createMockWalletProvider(),
    mockConnectedAPI: createMockConnectedAPI(),
    mockProofProvider: createMockProofProvider(),
    mockZKConfigProvider: createMockZKConfigProvider(),
    promptForCurrency: vi.fn().mockResolvedValue({ status: 'selected', currency: 'ADA' }),
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
          expiresAt: new Date(Date.now() + 60000).toISOString(),
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
    walletProvider: ctx.mockWalletProvider,
    connectedAPI: ctx.mockConnectedAPI,
    proofProvider: ctx.mockProofProvider,
    zkConfigProvider: ctx.mockZKConfigProvider,
    indexerUrl: 'http://localhost:8080/graphql',
    capacityExchangeUrl: 'http://localhost:3000',
    promptForCurrency: ctx.promptForCurrency,
    confirmOffer: ctx.confirmOffer,
  };
}
