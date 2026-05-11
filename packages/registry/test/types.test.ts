import { describe, it, expect } from 'vitest';
import {
  serverAddressToContract,
  serverAddressFromContract,
  entryToContract,
  entryFromContract,
  type ServerAddress,
} from '../src/types.js';

describe('serverAddressToContract / serverAddressFromContract', () => {
  it('SRV address round trip', () => {
    const addr: ServerAddress = { kind: 'srv', address: '_ces._tcp.example.com' };
    expect(serverAddressFromContract(serverAddressToContract(addr))).toEqual(addr);
  });

  it('SRV name with max-length round trips correctly', () => {
    // 256 bytes is the Compact SrvName max (Bytes<256>)
    const name = 'a'.repeat(128) + '.' + 'b'.repeat(127);
    expect(name.length).toBe(256);
    const addr: ServerAddress = { kind: 'srv', address: name };
    expect(serverAddressFromContract(serverAddressToContract(addr))).toEqual(addr);
  });

  it('SRV name too long throws', () => {
    const addr: ServerAddress = { kind: 'srv', address: 'a'.repeat(257) };
    expect(() => serverAddressToContract(addr)).toThrow(/too long/);
  });

  it('SRV name bytes are zero-padded to 256 bytes', () => {
    const addr: ServerAddress = { kind: 'srv', address: '_a._b' };
    const raw = serverAddressToContract(addr);
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
      address: { kind: 'srv' as const, address: '_ces._tcp.sundae.fi' },
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.address).toEqual(entry.address);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
