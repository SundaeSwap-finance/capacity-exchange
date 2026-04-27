import { describe, it, expect } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import { createAutoSelectCurrency } from './peerCurrencySelector.js';
import { PeerPriceService } from '../services/peerPrice.js';
import type { WalletService } from '../services/wallet.js';
import type { RawPriceFormula } from './prices.js';

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => silentLogger,
  level: 'silent',
} as unknown as FastifyBaseLogger;

function makePrice(rawId: string, amount: string, quoteId = `q-${rawId}`): ExchangePrice {
  return {
    quoteId,
    exchangeApi: {} as ExchangePrice['exchangeApi'],
    price: {
      amount,
      currency: { id: `midnight:shielded:${rawId}`, type: 'midnight:shielded', rawId },
    },
  };
}

function makeFormula(
  rawId: string,
  basePrice: string,
  rateNumerator = '1',
  rateDenominator = '1',
): RawPriceFormula {
  return {
    currency: { type: 'midnight:shielded', rawId },
    basePrice,
    rateNumerator,
    rateDenominator,
  };
}

function makeWalletService(balances: Record<string, bigint>): WalletService {
  return {
    getShieldedTokenBalances: async () => balances,
  } as unknown as WalletService;
}

const DUST_REQUIRED = 100n;
const REQ_ID = 'req-1';

describe('createAutoSelectCurrency', () => {
  it('picks the offer with the lowest offered/max ratio across currencies', async () => {
    // BTC: offered 1 vs max 1 -> ratio 1/1
    // ADA: offered 2 vs max 1000 -> ratio 2/1000 (far better)
    const peerPriceService = new PeerPriceService([
      makeFormula('btc', '1', '0', '1'),
      makeFormula('ada', '1000', '0', '1'),
    ]);
    const walletService = makeWalletService({ btc: 100n, ada: 100n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    const result = await select(
      [makePrice('btc', '1'), makePrice('ada', '2')],
      DUST_REQUIRED,
      REQ_ID,
    );

    expect(result).toEqual({
      status: 'selected',
      exchangePrice: expect.objectContaining({
        price: expect.objectContaining({
          currency: expect.objectContaining({ rawId: 'ada' }),
        }),
      }),
    });
  });

  it('rejects offers that exceed the configured max', async () => {
    const peerPriceService = new PeerPriceService([makeFormula('ada', '100', '0', '1')]);
    const walletService = makeWalletService({ ada: 10_000n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    await expect(select([makePrice('ada', '200')], DUST_REQUIRED, REQ_ID)).resolves.toEqual({
      status: 'no-eligible',
    });
  });

  it('skips currencies not allowlisted in peer.maxPrices', async () => {
    // Only ada has a max configured; btc is not allowlisted, even if offer is cheap.
    const peerPriceService = new PeerPriceService([makeFormula('ada', '1000', '0', '1')]);
    const walletService = makeWalletService({ btc: 10_000n, ada: 10_000n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    const result = await select(
      [makePrice('btc', '1'), makePrice('ada', '500')],
      DUST_REQUIRED,
      REQ_ID,
    );
    expect(result).toMatchObject({
      status: 'selected',
      exchangePrice: { price: { currency: { rawId: 'ada' } } },
    });
  });

  it('skips currencies with insufficient balance', async () => {
    const peerPriceService = new PeerPriceService([
      makeFormula('btc', '1000', '0', '1'),
      makeFormula('ada', '1000', '0', '1'),
    ]);
    // Server can't afford the btc offer but can afford ada.
    const walletService = makeWalletService({ btc: 0n, ada: 1_000_000n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    const result = await select(
      [makePrice('btc', '1'), makePrice('ada', '10')],
      DUST_REQUIRED,
      REQ_ID,
    );
    expect(result).toMatchObject({
      status: 'selected',
      exchangePrice: { price: { currency: { rawId: 'ada' } } },
    });
  });

  it('returns no-eligible when no candidate meets criteria', async () => {
    const peerPriceService = new PeerPriceService([makeFormula('ada', '100', '0', '1')]);
    const walletService = makeWalletService({ ada: 10n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    // over-max
    await expect(select([makePrice('ada', '999')], DUST_REQUIRED, REQ_ID)).resolves.toEqual({
      status: 'no-eligible',
    });
  });

  it('returns no-eligible when given zero prices', async () => {
    const peerPriceService = new PeerPriceService([]);
    const walletService = makeWalletService({});
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    await expect(select([], DUST_REQUIRED, REQ_ID)).resolves.toEqual({ status: 'no-eligible' });
  });

  it('breaks ratio ties deterministically by rawId lex order', async () => {
    // Two offers with identical ratios (1/100 each); 'aaa' < 'bbb' lex.
    const peerPriceService = new PeerPriceService([
      makeFormula('aaa', '100', '0', '1'),
      makeFormula('bbb', '100', '0', '1'),
    ]);
    const walletService = makeWalletService({ aaa: 10_000n, bbb: 10_000n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    const result = await select(
      [makePrice('bbb', '1'), makePrice('aaa', '1')],
      DUST_REQUIRED,
      REQ_ID,
    );
    expect(result).toMatchObject({
      status: 'selected',
      exchangePrice: { price: { currency: { rawId: 'aaa' } } },
    });
  });

  it('includes the linear rate component in the max', async () => {
    // max = 10 + specks * 1 = 10 + 100 = 110 at DUST_REQUIRED=100
    const peerPriceService = new PeerPriceService([makeFormula('ada', '10', '1', '1')]);
    const walletService = makeWalletService({ ada: 10_000n });
    const select = createAutoSelectCurrency(silentLogger, walletService, peerPriceService);

    // 109 accepted
    await expect(select([makePrice('ada', '109')], DUST_REQUIRED, REQ_ID)).resolves.toMatchObject({
      status: 'selected',
    });

    // 111 rejected
    await expect(select([makePrice('ada', '111')], DUST_REQUIRED, REQ_ID)).resolves.toEqual({
      status: 'no-eligible',
    });
  });
});
