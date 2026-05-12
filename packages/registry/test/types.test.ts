import { describe, it, expect } from 'vitest';
import {
  serverAddressToContract,
  serverAddressFromContract,
  entryToContract,
  entryFromContract,
  SRV_SERVICE_PREFIX,
} from '../src/types.js';

describe('serverAddressToContract / serverAddressFromContract', () => {
  it('SRV address round trip', () => {
    const addr = `${SRV_SERVICE_PREFIX}example.com`;
    expect(serverAddressFromContract(serverAddressToContract(addr))).toBe(addr);
  });

  it('SRV name with max-length round trips correctly', () => {
    // 256 bytes is the Compact SrvName max (Bytes<256>)
    const addr = 'a'.repeat(128) + '.' + 'b'.repeat(127);
    expect(addr.length).toBe(256);
    expect(serverAddressFromContract(serverAddressToContract(addr))).toBe(addr);
  });

  it('SRV name too long throws', () => {
    expect(() => serverAddressToContract('a'.repeat(257))).toThrow(/too long/);
  });

  it('SRV name bytes are zero-padded to 256 bytes', () => {
    const raw = serverAddressToContract('_a._b');
    expect(raw.length).toBe(256);
    expect(raw[0]).toBe('_'.charCodeAt(0));
    expect(raw[1]).toBe('a'.charCodeAt(0));
    expect(raw[5]).toBe(0);
  });
});

describe('entry round trip', () => {
  it('preserves all fields with SRV address', () => {
    const entry = {
      expiry: new Date('2026-07-01T00:00:00Z'),
      address: '_capacityexchange._tcp.sundae.fi',
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.address).toBe(entry.address);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
