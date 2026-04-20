import { describe, it, expect } from 'vitest';
import { ipToContract, ipFromContract, entryToContract, entryFromContract, type IpAddress } from '../src/types.js';

describe('IPv4 round trip', () => {
  it('simple address', () => {
    const ip: IpAddress = { kind: 'ipv4', address: '192.168.1.1' };
    expect(ipFromContract(ipToContract(ip))).toEqual(ip);
  });

  it('all zeros', () => {
    const ip: IpAddress = { kind: 'ipv4', address: '0.0.0.0' };
    expect(ipFromContract(ipToContract(ip))).toEqual(ip);
  });

  it('all 255s', () => {
    const ip: IpAddress = { kind: 'ipv4', address: '255.255.255.255' };
    expect(ipFromContract(ipToContract(ip))).toEqual(ip);
  });

  it('byte order is correct', () => {
    const ip: IpAddress = { kind: 'ipv4', address: '1.2.3.4' };
    const raw = ipToContract(ip);
    expect(raw.is_left).toBe(true);
    expect(Array.from(raw.left)).toEqual([1, 2, 3, 4]);
  });
});

describe('IPv6 round trip', () => {
  it('full address', () => {
    const ip: IpAddress = { kind: 'ipv6', address: '2001:db8:85a3:0:0:8a2e:370:7334' };
    expect(ipFromContract(ipToContract(ip))).toEqual(ip);
  });

  it('loopback', () => {
    const ip: IpAddress = { kind: 'ipv6', address: '::1' };
    const result = ipFromContract(ipToContract(ip));
    expect(result.kind).toBe('ipv6');
    // ::1 expands to 0:0:0:0:0:0:0:1
    expect(result).toEqual({ kind: 'ipv6', address: '0:0:0:0:0:0:0:1' });
  });

  it('all zeros', () => {
    const ip: IpAddress = { kind: 'ipv6', address: '::' };
    const result = ipFromContract(ipToContract(ip));
    expect(result).toEqual({ kind: 'ipv6', address: '0:0:0:0:0:0:0:0' });
  });

  it('byte order is correct', () => {
    // 0x1234 should be stored as [0x12, 0x34] (big-endian)
    const ip: IpAddress = { kind: 'ipv6', address: '1234::' };
    const raw = ipToContract(ip);
    expect(raw.is_left).toBe(false);
    expect(raw.right[0]).toBe(0x12);
    expect(raw.right[1]).toBe(0x34);
  });

  it('abbreviated with trailing groups', () => {
    const ip: IpAddress = { kind: 'ipv6', address: 'fe80::1:2' };
    const result = ipFromContract(ipToContract(ip));
    expect(result).toEqual({ kind: 'ipv6', address: 'fe80:0:0:0:0:0:1:2' });
  });
});

describe('entry round trip', () => {
  it('preserves all fields', () => {
    const entry = {
      expiry: new Date('2026-05-01T00:00:00Z'),
      ip: { kind: 'ipv4' as const, address: '10.0.0.1' },
      port: 443,
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.ip).toEqual(entry.ip);
    expect(result.port).toBe(entry.port);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
