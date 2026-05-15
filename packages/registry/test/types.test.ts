import { describe, it, expect } from 'vitest';
import {
  toDomainName,
  toSrvName,
  domainNameToContract,
  domainNameFromContract,
  entryToContract,
  entryFromContract,
  SRV_SERVICE_PREFIX,
} from '../src/types.js';

describe('toDomainName', () => {
  it('accepts a bare domain name', () => {
    expect(toDomainName('example.com')).toBe('example.com');
  });

  it('trims whitespace and lowercases', () => {
    expect(toDomainName('  Example.COM  ')).toBe('example.com');
  });

  it('throws if given a full SRV name', () => {
    expect(() => toDomainName(`${SRV_SERVICE_PREFIX}example.com`)).toThrow('expected bare domain, got SRV name');
  });
});

describe('toSrvName', () => {
  it('prepends SRV_SERVICE_PREFIX to a domain name', () => {
    const d = toDomainName('example.com');
    expect(toSrvName(d)).toBe(`${SRV_SERVICE_PREFIX}example.com`);
  });
});

describe('domainNameToContract / domainNameFromContract', () => {
  it('round trips a bare domain name', () => {
    const d = toDomainName('example.com');
    expect(domainNameFromContract(domainNameToContract(d))).toBe(d);
  });

  it('round trips a max-length domain name (128 bytes)', () => {
    const d = toDomainName('a'.repeat(64) + '.' + 'b'.repeat(63));
    expect(d.length).toBe(128);
    expect(domainNameFromContract(domainNameToContract(d))).toBe(d);
  });

  it('throws when domain name is too long', () => {
    // 129-char ASCII string exceeds 128-byte limit
    expect(() => domainNameToContract(toDomainName('a'.repeat(63) + '.' + 'b'.repeat(65)))).toThrow(/too long/);
  });

  it('throws when domain name is empty', () => {
    // toDomainName('') produces an empty DomainName; domainNameToContract rejects it
    expect(() => domainNameToContract('' as ReturnType<typeof toDomainName>)).toThrow(/empty/);
  });

  it('zero-pads bytes to 128', () => {
    const raw = domainNameToContract(toDomainName('ab.cd'));
    expect(raw.length).toBe(128);
    expect(raw[0]).toBe('a'.charCodeAt(0));
    expect(raw[4]).toBe('d'.charCodeAt(0));
    expect(raw[5]).toBe(0);
  });
});

describe('entry round trip', () => {
  it('preserves domainName and expiry', () => {
    const entry = {
      expiry: new Date('2026-07-01T00:00:00Z'),
      domainName: toDomainName('sundae.fi'),
    };
    const result = entryFromContract(entryToContract(entry));
    expect(result.domainName).toBe(entry.domainName);
    // Date round trip truncates to seconds
    expect(result.expiry.getTime()).toBe(Math.floor(entry.expiry.getTime() / 1000) * 1000);
  });
});
