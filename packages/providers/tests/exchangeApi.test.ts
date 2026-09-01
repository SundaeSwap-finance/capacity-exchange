import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCapacityExchangeUrls } from '@sundaeswap/capacity-exchange-core';
import { resolveCesUrls } from '../src/wallet/exchangeApi.js';

const SOURCE = fileURLToPath(new URL('../src/wallet/exchangeApi.ts', import.meta.url));

describe('resolveCesUrls', () => {
  it.each(['preview', 'preprod', 'mainnet', 'undeployed'])('seeds %s from the core network defaults', (networkId) => {
    expect(resolveCesUrls(networkId, [])).toEqual(defaultCapacityExchangeUrls(networkId));
  });

  it('appends an extra url after the network default', () => {
    expect(resolveCesUrls('preview', ['https://ces.example'])).toEqual([
      'https://capacity-exchange.preview.sundae.fi',
      'https://ces.example',
    ]);
  });

  it('does not repeat a url that is already the network default', () => {
    expect(resolveCesUrls('preview', ['https://capacity-exchange.preview.sundae.fi'])).toEqual([
      'https://capacity-exchange.preview.sundae.fi',
    ]);
  });

  it('appends registry urls after the extras', () => {
    expect(resolveCesUrls('preprod', ['https://a.example'], ['https://b.example'])).toEqual([
      'https://capacity-exchange.preprod.sundae.fi',
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('returns only the extras for an unknown network rather than throwing', () => {
    expect(resolveCesUrls('testnet', ['https://ces.example'])).toEqual(['https://ces.example']);
  });

  // The mainnet exchange is a floor, not a default. A dapp embedding this library
  // passes its own urls and the registry supplies more, and neither may displace
  // ours, so the guarantee is that ours is always present whatever else is passed.
  describe('the mainnet exchange survives whatever a caller passes', () => {
    const MAINNET = 'https://capacity-exchange.sundae.fi';

    it.each([
      ['no urls at all', [], []],
      ['a competing url', ['https://not-ours.example'], []],
      ['a registry offering only its own', [], ['https://not-ours.example']],
      ['both, several times over', ['https://a.example', 'https://b.example'], ['https://c.example']],
    ])('is still in the list given %s', (_case, extras, registry) => {
      expect(resolveCesUrls('mainnet', extras, registry)).toContain(MAINNET);
    });

    it('stays first, so it is tried before anything a caller added', () => {
      expect(resolveCesUrls('mainnet', ['https://not-ours.example'])[0]).toBe(MAINNET);
    });
  });

  // The URLs used to be repeated here as a second table alongside the core one, so
  // the two could drift apart with nothing comparing them. This pins the deletion:
  // the values live in core, and this module only reads them.
  it('keeps no exchange url of its own, so there is one table to change', () => {
    expect(readFileSync(SOURCE, 'utf-8')).not.toContain('sundae.fi');
  });
});
