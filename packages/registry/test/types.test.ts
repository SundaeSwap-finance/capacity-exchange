import { describe, it, expect } from 'vitest';
import {
  ipToContract,
  ipFromContract,
  hostToContract,
  hostFromContract,
  entryToContract,
  entryFromContract,
  type IpAddress,
  type Host,
} from '../src/types.js';

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

describe('hostToContract / hostFromContract', () => {
  it('IPv4 host round trip', () => {
    const host: Host = { kind: 'ipv4', address: '192.168.1.1' };
    expect(hostFromContract(hostToContract(host))).toEqual(host);
  });

  it('IPv6 host round trip', () => {
    const host: Host = { kind: 'ipv6', address: '2001:db8::1' };
    const result = hostFromContract(hostToContract(host));
    expect(result.kind).toBe('ipv6');
    expect((result as { kind: 'ipv6'; address: string }).address).toBe('2001:db8:0:0:0:0:0:1');
  });

  it('hostname round trip', () => {
    const host: Host = { kind: 'hostname', address: 'my-server.example.com' };
    expect(hostFromContract(hostToContract(host))).toEqual(host);
  });

  it('hostname with max-length name round trips correctly', () => {
    // 128 bytes is the Compact Hostname max (Bytes<128>)
    const address = 'a'.repeat(64) + '.' + 'b'.repeat(63);
    expect(address.length).toBe(128);
    const host: Host = { kind: 'hostname', address };
    expect(hostFromContract(hostToContract(host))).toEqual(host);
  });

  it('hostname too long throws', () => {
    const host: Host = { kind: 'hostname', address: 'a'.repeat(129) };
    expect(() => hostToContract(host)).toThrow(/too long/);
  });

  it('IPv4 is_left=true, hostname is_left=false', () => {
    const ipRaw = hostToContract({ kind: 'ipv4', address: '1.2.3.4' });
    expect(ipRaw.is_left).toBe(true);

    const hostnameRaw = hostToContract({ kind: 'hostname', address: 'example.com' });
    expect(hostnameRaw.is_left).toBe(false);
  });

  it('hostname bytes are zero-padded to 128 bytes', () => {
    const host: Host = { kind: 'hostname', address: 'hi' };
    const raw = hostToContract(host);
    expect(raw.right.length).toBe(128);
    expect(raw.right[0]).toBe('h'.charCodeAt(0));
    expect(raw.right[1]).toBe('i'.charCodeAt(0));
    expect(raw.right[2]).toBe(0);
  });
});

describe('entry round trip', () => {
  it('preserves all fields with IPv4 host', () => {
    const entry = {
      expiry: new Date('2026-05-01T00:00:00Z'),
      host: { kind: 'ipv4' as const, address: '10.0.0.1' },
      port: 443,
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.host).toEqual(entry.host);
    expect(result.port).toBe(entry.port);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });

  it('preserves all fields with IPv6 host', () => {
    const entry = {
      expiry: new Date('2026-06-01T00:00:00Z'),
      host: { kind: 'ipv6' as const, address: '2001:db8:0:0:0:0:0:1' },
      port: 8080,
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.host).toEqual(entry.host);
    expect(result.port).toBe(entry.port);
  });

  it('preserves all fields with hostname host', () => {
    const entry = {
      expiry: new Date('2026-07-01T00:00:00Z'),
      host: { kind: 'hostname' as const, address: 'ces.sundae.fi' },
      port: 443,
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.host).toEqual(entry.host);
    expect(result.port).toBe(entry.port);
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
