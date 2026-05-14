import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRegistryCesUrls } from '../src/wallet/registryLookup';
import { makeDohAnswer } from './helpers/srvFixtures';

vi.mock('@sundaeswap/capacity-exchange-registry', () => ({
  SRV_SERVICE_PREFIX: '_capacityexchange._tcp.',
  toDomainName: (s: string) => s,
  toSrvName: (d: string) => `_capacityexchange._tcp.${d}`,
  ledger: vi.fn((data) => data),
  registryEntries: vi.fn(),
}));

import { registryEntries } from '@sundaeswap/capacity-exchange-registry';
import type { DomainName } from '@sundaeswap/capacity-exchange-registry';

const future = new Date(Date.now() + 86_400_000); // 1 day from now
const past = new Date(Date.now() - 1);

const d = (s: string) => s as DomainName;

function makeProvider(state: unknown) {
  return {
    queryContractState: vi.fn().mockResolvedValue(state),
    getLedgerParameters: vi.fn(),
  };
}

function mockFetch(answers: ReturnType<typeof makeDohAnswer>[]) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ Status: 0, Answer: answers }), { status: 200 }));
}

describe('fetchRegistryCesUrls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when contract state is not found', async () => {
    const provider = makeProvider(null);

    await expect(fetchRegistryCesUrls(provider, 'addr1')).rejects.toThrow(
      'No contract state found at registry address addr1'
    );
  });

  it('returns resolved URLs for non-expired entries', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([
      { key: new Uint8Array(), entry: { domainName: d('example.com'), expiry: future } },
    ]);
    mockFetch([makeDohAnswer(10, 100, 8080, 'example.com.')]);

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    expect(result).toEqual(['https://example.com:8080']);
  });

  it('filters out expired entries', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([
      { key: new Uint8Array(), entry: { domainName: d('example.com'), expiry: past } },
    ]);

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    expect(result).toEqual([]);
  });

  it('resolves domain name to the correct SRV query', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([
      { key: new Uint8Array(), entry: { domainName: d('ces.sundae.fi'), expiry: future } },
    ]);
    const fetchSpy = mockFetch([makeDohAnswer(10, 100, 443, 'ces.sundae.fi.')]);

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    // toSrvName converts 'ces.sundae.fi' → '_capacityexchange._tcp.ces.sundae.fi'
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('_capacityexchange._tcp.ces.sundae.fi')),
      expect.any(Object)
    );
    expect(result).toEqual(['https://ces.sundae.fi:443']);
  });

  it('silently omits entries that fail to resolve', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([
      { key: new Uint8Array(), entry: { domainName: d('bad.example.com'), expiry: future } },
      { key: new Uint8Array(), entry: { domainName: d('good.example.com'), expiry: future } },
    ]);
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('bad.example.com')) {
        return Promise.reject(new Error('NXDOMAIN'));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ Status: 0, Answer: [makeDohAnswer(10, 100, 8080, 'good.example.com.')] }), {
          status: 200,
        })
      );
    });

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    expect(result).toEqual(['https://good.example.com:8080']);
  });

  it('returns an empty array when all entries are expired', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([
      { key: new Uint8Array(), entry: { domainName: d('example.com'), expiry: past } },
    ]);

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    expect(result).toEqual([]);
  });

  it('returns an empty array when registry has no entries', async () => {
    const provider = makeProvider({ data: {} });
    vi.mocked(registryEntries).mockReturnValue([]);

    const result = await fetchRegistryCesUrls(provider, 'addr1');

    expect(result).toEqual([]);
  });
});
