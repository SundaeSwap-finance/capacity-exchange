import { describe, it, expect, vi } from 'vitest';
import { OfferService } from './offer.js';
import type { UtxoService } from './utxo.js';
import type { TxService } from './tx.js';
import type { PriceService } from './price.js';
import type { MetricsService } from './metrics.js';

import pino from 'pino';

const logger = pino({ level: 'silent' });

function createMockDeps() {
  const utxoService = {
    lockUtxo: vi.fn(() => ({
      status: 'ok' as const,
      value: {
        id: 'utxo-1',
        utxo: {},
        spend: {},
        expiresAtMillis: Date.now() + 60_000,
      },
    })),
    unlock: vi.fn(),
  } as unknown as UtxoService;

  const txService = {
    createOfferTx: vi.fn(async () => ({
      serialize: () => new Uint8Array([0xde, 0xad]),
    })),
  } as unknown as TxService;

  const priceService = {
    getPrice: vi.fn(() => ({ status: 'ok' as const, price: 1000n })),
  } as unknown as PriceService;

  const metricsService = {
    recordDustUsage: vi.fn(),
    recordRevenue: vi.fn(),
  } as unknown as MetricsService;

  return { utxoService, txService, priceService, metricsService };
}

describe('OfferService', () => {
  let service: OfferService;
  let deps: ReturnType<typeof createMockDeps>;


  it('returns cached offer on retry with same quoteId + currency', async () => {
    deps = createMockDeps();
    service = new OfferService(deps.utxoService, deps.txService, deps.priceService, deps.metricsService, 60, logger);

    const request = { quoteId: 'q1', specks: 1000n, offerCurrency: '0fac6767295957138e27f92bddd129519e6ab8d72891454af474e41ab835dcd0' };

    const first = await service.createOffer(request);
    const second = await service.createOffer(request);

    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    if (first.status === 'ok' && second.status === 'ok') {
      expect(second.offer).toEqual(first.offer);
    }
    // UTXO locked only once, tx proven only once
    expect(deps.utxoService.lockUtxo).toHaveBeenCalledTimes(1);
    expect(deps.txService.createOfferTx).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent requests into a single build', async () => {
    deps = createMockDeps();
    let resolveProve!: () => void;
    (deps.txService.createOfferTx as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => {
        resolveProve = () => resolve({ serialize: () => new Uint8Array([0xde, 0xad]) });
      }),
    );
    service = new OfferService(deps.utxoService, deps.txService, deps.priceService, deps.metricsService, 60, logger);

    const request = { quoteId: 'q-coal', specks: 1000n, offerCurrency: '0fac6767295957138e27f92bddd129519e6ab8d72891454af474e41ab835dcd0' };

    const first = service.createOffer(request);
    const second = service.createOffer(request);

    // Both in-flight, but only one build started
    expect(deps.utxoService.lockUtxo).toHaveBeenCalledTimes(1);
    expect(deps.txService.createOfferTx).toHaveBeenCalledTimes(1);

    resolveProve();
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    if (r1.status === 'ok' && r2.status === 'ok') {
      expect(r2.offer).toEqual(r1.offer);
    }
  });

  it('unlocks UTXO when tx proving throws', async () => {
    deps = createMockDeps();
    (deps.txService.createOfferTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('proof server down'),
    );
    service = new OfferService(deps.utxoService, deps.txService, deps.priceService, deps.metricsService, 60, logger);

    const request = { quoteId: 'q2', specks: 1000n, offerCurrency: '0fac6767295957138e27f92bddd129519e6ab8d72891454af474e41ab835dcd0' };

    await expect(service.createOffer(request)).rejects.toThrow('proof server down');
    expect(deps.utxoService.unlock).toHaveBeenCalledWith('utxo-1');
  });
});
