import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { capacityExchangeWalletProvider } from '../src/wallet/capacityExchangeWalletProvider';
import { createMockUnprovenTransaction } from './mocks/mockProviders';
import {
  createTestContext,
  createTestConfig,
  setupFetchMock,
  type TestContext,
} from './setup/capacityExchangeWalletProviderSetup';

vi.mock('../src/wallet/utils', async () => {
  const actual = await vi.importActual('../src/wallet/utils');
  return {
    ...actual,
    getLedgerParameters: vi.fn().mockResolvedValue({} as any),
  };
});

vi.mock('@midnight-ntwrk/ledger-v6', async () => {
  const actual = await vi.importActual('@midnight-ntwrk/ledger-v6');
  return {
    ...actual,
    Transaction: {
      deserialize: vi.fn(() => ({
        bind: () => ({
          merge: vi.fn(),
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
    const mockTx = createMockUnprovenTransaction(50000n);

    const result = await provider.balanceTx(mockTx, [], new Date(Date.now() + 60000));

    expect(result).toBeDefined();
    expect(result.type).toBe('NothingToProve');
    if (result.type === 'NothingToProve') {
      expect(result.transaction).toBeDefined();
    }

    expect(ctx.promptForCurrency).toHaveBeenCalledTimes(1);
    expect(ctx.confirmOffer).toHaveBeenCalledTimes(1);
    expect(ctx.mockConnectedAPI.balanceSealedTransaction).toHaveBeenCalledTimes(1);
  });

  it('should preserve original WalletProvider methods', () => {
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));

    expect(provider.getCoinPublicKey()).toBe('mock-coin-public-key');
    expect(provider.getEncryptionPublicKey()).toBe('mock-encryption-public-key');
  });

  it('should calculate DUST requirements correctly', async () => {
    const dustRequired = 75000n;
    const provider = capacityExchangeWalletProvider(createTestConfig(ctx));
    const mockTx = createMockUnprovenTransaction(dustRequired);

    await provider.balanceTx(mockTx, [], new Date(Date.now() + 60000));

    expect(ctx.promptForCurrency).toHaveBeenCalledWith(expect.anything(), dustRequired);
    expect(ctx.confirmOffer).toHaveBeenCalledWith(expect.anything(), dustRequired);
  });
});
