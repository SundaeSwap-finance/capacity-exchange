import { createHmac, randomUUID } from 'crypto';
import type { Price } from './price.js';

export interface Quote {
  specks: bigint;
  prices: Price[];
}

export type GetQuoteResult =
  | { status: 'ok'; quote: Quote }
  | { status: 'invalid' }
  | { status: 'expired' };

interface QuotePayload {
  specks: string;
  prices: Price[];
  nonce: string;
  exp: number;
}

/**
 * Creates and decodes quotes. A quote is a signed token that encodes a price snapshot.
 * Because the token holds the snapshot, we don't need to save any state. The server
 * verifies the token's signature and extracts the price snapshot.
 */
export class QuoteService {
  private readonly ttlSeconds: number;
  private readonly secret: Buffer;

  constructor(ttlSeconds: number, secret: Buffer) {
    this.ttlSeconds = ttlSeconds;
    this.secret = secret;
  }

  /** Sign the data with the server's secret. */
  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  /** Creates a signed quote token. Format: base64url(payload).base64url(signature) */
  createQuote(specks: bigint, prices: Price[]): string {
    const payload: QuotePayload = {
      specks: specks.toString(),
      prices,
      nonce: randomUUID(),
      exp: Date.now() + this.ttlSeconds * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  /** Verifies and decodes a quote token. */
  getQuote(token: string): GetQuoteResult {
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) {
      return { status: 'invalid' };
    }

    const encodedPayload = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);

    if (this.sign(encodedPayload) !== signature) {
      return { status: 'invalid' };
    }

    try {
      const payload: QuotePayload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString(),
      );
      if (Date.now() > payload.exp) {
        return { status: 'expired' };
      }

      return {
        status: 'ok',
        quote: {
          specks: BigInt(payload.specks),
          prices: payload.prices,
        },
      };
    } catch {
      return { status: 'invalid' };
    }
  }
}
