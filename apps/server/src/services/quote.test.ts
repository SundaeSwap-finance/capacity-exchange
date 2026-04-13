import { describe, it, expect, vi } from 'vitest';
import { QuoteService } from './quote.js';
import { randomBytes } from 'crypto';

const secret = randomBytes(32);

describe('QuoteService', () => {
  const service = new QuoteService(10, secret);

  it('creates a token and decodes it back', () => {
    const prices = [
      {
        amount: '1000',
        currency: {
          id: 'midnight:shielded:lovelace',
          type: 'midnight:shielded' as const,
          rawId: 'lovelace',
        },
      },
    ];
    const token = service.createQuote(500n, prices);
    const result = service.getQuote(token);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.quote.currency).toBe('DUST');
    expect(result.quote.amount).toBe(500n);
    expect(result.quote.prices).toEqual(prices);
  });

  it('returns invalid for garbage token', () => {
    expect(service.getQuote('not-a-valid-token')).toEqual({ status: 'invalid' });
  });

  it('returns invalid for tampered token', () => {
    const token = service.createQuote(500n, []);
    const tampered = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');
    expect(service.getQuote(tampered)).toEqual({ status: 'invalid' });
  });

  it('returns expired for expired token', () => {
    vi.useFakeTimers();
    try {
      const token = service.createQuote(500n, []);
      vi.advanceTimersByTime(11_000);
      expect(service.getQuote(token)).toEqual({ status: 'expired' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns invalid for tokens signed with a different secret', () => {
    const otherService = new QuoteService(10, randomBytes(32));
    const token = otherService.createQuote(500n, []);
    expect(service.getQuote(token)).toEqual({ status: 'invalid' });
  });
});
