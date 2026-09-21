import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PriceConfig } from './config/prices.js';

// loadConfig() calls dotenv's `config()` unconditionally. Real repo has a
// `.env` file (with WALLET_STATE_DIR set) that would otherwise leak into these
// tests and defeat the "env var not set" scenarios below.
vi.mock('dotenv', () => ({ config: vi.fn() }));

vi.mock('./config/wallet.js', () => ({
  createWalletResources: vi.fn(async () => ({
    walletConnection: {} as never,
    walletStateStore: {} as never,
  })),
}));

vi.mock('./config/prices.js', async (importActual) => {
  const actual = await importActual<typeof import('./config/prices.js')>();
  return { ...actual, loadPriceConfig: vi.fn() };
});

import { loadConfig } from './loadConfig.js';
import { loadPriceConfig } from './config/prices.js';
import { createWalletResources } from './config/wallet.js';

const BASE_ENV: Record<string, string> = {
  PRICE_CONFIG_FILE: 'unused.json',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  QUOTE_TTL_SECONDS: '300',
  QUOTE_SECRET_FILE: 'unused.key',
  OFFER_TTL_SECONDS: '2',
};

function priceConfigFor(assets: Partial<PriceConfig['priceFormulas']>): PriceConfig {
  return { priceFormulas: assets, sponsoredContracts: [] };
}

const ADA_ONLY = priceConfigFor({
  ADA: [
    {
      currency: { type: 'cardano:ada', rawId: '' },
      basePrice: '0',
      rateNumerator: '1',
      rateDenominator: '1',
    },
  ],
});

const DUST_PRICED = priceConfigFor({
  DUST: [
    {
      currency: { type: 'midnight:shielded', rawId: 'lovelace' },
      basePrice: '0',
      rateNumerator: '1',
      rateDenominator: '1',
    },
  ],
});

describe('loadConfig — optional Midnight configuration', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv, ...BASE_ENV };
    delete process.env.MIDNIGHT_NETWORK;
    delete process.env.WALLET_STATE_DIR;
    vi.mocked(loadPriceConfig).mockReset();
    vi.mocked(createWalletResources).mockClear();
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('succeeds without MIDNIGHT_NETWORK or WALLET_STATE_DIR when only ADA is priced', async () => {
    vi.mocked(loadPriceConfig).mockReturnValue(ADA_ONLY);

    const { config } = await loadConfig();

    expect(config.midnight).toBeUndefined();
    expect(createWalletResources).not.toHaveBeenCalled();
  });

  it('throws if DUST is priced but MIDNIGHT_NETWORK is not set', async () => {
    vi.mocked(loadPriceConfig).mockReturnValue(DUST_PRICED);

    await expect(loadConfig()).rejects.toThrow(/MIDNIGHT_NETWORK is required/);
  });

  it('throws if DUST is priced but WALLET_STATE_DIR is not set', async () => {
    process.env.MIDNIGHT_NETWORK = 'undeployed';
    vi.mocked(loadPriceConfig).mockReturnValue(DUST_PRICED);

    await expect(loadConfig()).rejects.toThrow(/WALLET_STATE_DIR is required/);
  });

  it('creates wallet resources when DUST is priced and both are set', async () => {
    process.env.MIDNIGHT_NETWORK = 'undeployed';
    process.env.WALLET_STATE_DIR = './.wallet-state-test';
    vi.mocked(loadPriceConfig).mockReturnValue(DUST_PRICED);

    const { config } = await loadConfig();

    expect(config.midnight?.networkId).toBeDefined();
    expect(config.midnight?.endpoints).toBeDefined();
    expect(createWalletResources).toHaveBeenCalledOnce();
  });

  it(
    'does not attempt wallet setup for an ADA-only server even if MIDNIGHT_NETWORK ' +
      'happens to be set, and does not require WALLET_STATE_DIR in that case',
    async () => {
      // Regression: was gated on env.MIDNIGHT_NETWORK alone, so this used to throw.
      process.env.MIDNIGHT_NETWORK = 'undeployed';
      vi.mocked(loadPriceConfig).mockReturnValue(ADA_ONLY);

      const { config } = await loadConfig();

      expect(config.midnight).toBeUndefined();
      expect(createWalletResources).not.toHaveBeenCalled();
    },
  );
});
