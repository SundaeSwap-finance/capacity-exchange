import { describe, expect, it } from 'vitest';
import { resolveEndpoints, toNetworkIdEnum } from '../src/networks.js';

// NETWORK_DEFAULTS is the one table of per-network endpoints. capacityExchangeUrl
// lives here with the rest so a network's endpoints are read from a single place,
// and packages/providers seeds its CES server list from it rather than repeating
// the URLs.

describe('resolveEndpoints capacityExchangeUrl', () => {
  it.each([
    ['preview', 'https://capacity-exchange.preview.sundae.fi'],
    ['preprod', 'https://capacity-exchange.preprod.sundae.fi'],
    ['mainnet', 'https://capacity-exchange.sundae.fi'],
  ])('resolves the hosted exchange for %s', (networkId, expected) => {
    expect(resolveEndpoints(toNetworkIdEnum(networkId)).capacityExchangeUrl).toBe(expected);
  });

  it('has no hosted exchange for undeployed, where the operator runs their own', () => {
    expect(resolveEndpoints(toNetworkIdEnum('undeployed')).capacityExchangeUrl).toBeUndefined();
  });

  it('prefers an override, so a dev server can aim at a local exchange', () => {
    const endpoints = resolveEndpoints(toNetworkIdEnum('preview'), { capacityExchangeUrl: 'http://localhost:3000' });
    expect(endpoints.capacityExchangeUrl).toBe('http://localhost:3000');
  });

  it('falls back to the default when the override is absent', () => {
    const endpoints = resolveEndpoints(toNetworkIdEnum('preprod'), { capacityExchangeUrl: undefined });
    expect(endpoints.capacityExchangeUrl).toBe('https://capacity-exchange.preprod.sundae.fi');
  });

  it('still resolves the other endpoints unchanged', () => {
    const endpoints = resolveEndpoints(toNetworkIdEnum('preview'));
    expect(endpoints.proofServerUrl).toBe('https://proof.capacity-exchange.preview.sundae.fi');
    expect(endpoints.nodeUrl).toBe('wss://rpc.preview.midnight.network/ws');
  });
});

describe('defaultCapacityExchangeUrls', () => {
  it.each([
    ['preview', ['https://capacity-exchange.preview.sundae.fi']],
    ['preprod', ['https://capacity-exchange.preprod.sundae.fi']],
    ['mainnet', ['https://capacity-exchange.sundae.fi']],
  ])('lists the hosted exchange for %s', async (networkId, expected) => {
    const { defaultCapacityExchangeUrls } = await import('../src/networks.js');
    expect(defaultCapacityExchangeUrls(networkId)).toEqual(expected);
  });

  it('lists nothing for undeployed, which runs no hosted exchange', async () => {
    const { defaultCapacityExchangeUrls } = await import('../src/networks.js');
    expect(defaultCapacityExchangeUrls('undeployed')).toEqual([]);
  });

  // resolveCesUrls takes a raw string, so an unknown one has to fall through to an
  // empty list rather than throwing the way toNetworkIdEnum does.
  it('lists nothing for an unknown network rather than throwing', async () => {
    const { defaultCapacityExchangeUrls } = await import('../src/networks.js');
    expect(defaultCapacityExchangeUrls('testnet')).toEqual([]);
  });
});
