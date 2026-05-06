import { describe, it, expect } from 'vitest';
import {
  ipToContract,
  ipFromContract,
  serverAddressToContract,
  serverAddressFromContract,
  entryToContract,
  entryFromContract,
  type IpAddress,
  type ServerAddress,
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

describe('serverAddressToContract / serverAddressFromContract', () => {
  it('IPv4 socket address round trip', () => {
    const addr: ServerAddress = { kind: 'ip', host: { kind: 'ipv4', address: '192.168.1.1' }, port: 443 };
    expect(serverAddressFromContract(serverAddressToContract(addr))).toEqual(addr);
  });

  it('IPv6 socket address round trip', () => {
    const addr: ServerAddress = { kind: 'ip', host: { kind: 'ipv6', address: '2001:db8::1' }, port: 8080 };
    const result = serverAddressFromContract(serverAddressToContract(addr));
    expect(result.kind).toBe('ip');
    expect((result as { kind: 'ip'; host: { kind: string; address: string }; port: number }).host.address).toBe(
      '2001:db8:0:0:0:0:0:1'
    );
  });

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

  it('IP address is_left=true, SRV is_left=false', () => {
    const ipRaw = serverAddressToContract({ kind: 'ip', host: { kind: 'ipv4', address: '1.2.3.4' }, port: 80 });
    expect(ipRaw.is_left).toBe(true);

    const srvRaw = serverAddressToContract({ kind: 'srv', address: '_ces._tcp.example.com' });
    expect(srvRaw.is_left).toBe(false);
  });

  it('SRV name bytes are zero-padded to 256 bytes', () => {
    const addr: ServerAddress = { kind: 'srv', address: '_a._b' };
    const raw = serverAddressToContract(addr);
    expect(raw.right.length).toBe(256);
    expect(raw.right[0]).toBe('_'.charCodeAt(0));
    expect(raw.right[1]).toBe('a'.charCodeAt(0));
    expect(raw.right[5]).toBe(0);
  });
});

describe('entry round trip', () => {
  it('preserves all fields with IPv4 socket address', () => {
    const entry = {
      expiry: new Date('2026-05-01T00:00:00Z'),
      address: { kind: 'ip' as const, host: { kind: 'ipv4' as const, address: '10.0.0.1' }, port: 443 },
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.address).toEqual(entry.address);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });

  it('preserves all fields with IPv6 socket address', () => {
    const entry = {
      expiry: new Date('2026-06-01T00:00:00Z'),
      address: { kind: 'ip' as const, host: { kind: 'ipv6' as const, address: '2001:db8:0:0:0:0:0:1' }, port: 8080 },
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.address).toEqual(entry.address);
  });

  it('preserves all fields with SRV address', () => {
    const entry = {
      expiry: new Date('2026-07-01T00:00:00Z'),
      address: { kind: 'srv' as const, address: '_ces._tcp.sundae.fi' },
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.address).toEqual(entry.address);
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
