import { vi } from 'vitest';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import type {
  CapacityExchangeConfig,
  ExchangePrice,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
  BalanceSealedTransaction,
  BalanceUnsealedTransaction,
} from '../../src/wallet/types';
import type { ChainStateProvider } from '../../src/wallet/chainStateProvider';
import { createMockWalletProvider } from '../mocks/mockProviders';

export interface TestContext {
  mockWalletProvider: ReturnType<typeof createMockWalletProvider>;
  mockBalanceUnsealedTransaction: BalanceUnsealedTransaction;
  mockBalanceSealedTransaction: BalanceSealedTransaction;
  promptForCurrency: (prices: ExchangePrice[], dustRequired: bigint) => Promise<CurrencySelectionResult>;
  confirmOffer: (offer: Offer, dustRequired: bigint) => Promise<OfferConfirmationResult>;
}

export function createTestContext(): TestContext {
  const mockWalletProvider = createMockWalletProvider();
  return {
    mockWalletProvider,
    mockBalanceUnsealedTransaction: vi.fn().mockResolvedValue({ tx: '' } as any),
    mockBalanceSealedTransaction: vi.fn().mockResolvedValue({ tx: '' } as any),
    promptForCurrency: vi.fn().mockImplementation((exchangePrices: ExchangePrice[]) => {
      const selectedPrice = exchangePrices.find((ep) => ep.price.currency.rawId === 'ADA') || exchangePrices[0];
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
            { currency: { id: 'midnight:shielded:ADA', type: 'midnight:shielded', rawId: 'ADA' }, amount: '1000000' },
            { currency: { id: 'midnight:shielded:BTC', type: 'midnight:shielded', rawId: 'BTC' }, amount: '50000' },
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
          offerCurrency: {
            id: 'midnight:shielded:ADA',
            type: 'midnight:shielded',
            rawId: 'ADA',
          },
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
    networkId: 'undeployed',
    coinPublicKey: ctx.mockWalletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.mockWalletProvider.getEncryptionPublicKey(),
    balanceUnsealedTransaction: ctx.mockBalanceUnsealedTransaction,
    balanceSealedTransaction: ctx.mockBalanceSealedTransaction,
    chainStateProvider: {
      queryContractState: async () => null,
      getLedgerParameters: async () => ({}) as LedgerParameters,
    } satisfies ChainStateProvider,
    additionalCapacityExchangeUrls: ['http://localhost:3000'],
    promptForCurrency: ctx.promptForCurrency,
    confirmOffer: ctx.confirmOffer,
    margin: 3,
  };
}
