import * as fs from 'fs';
import * as crypto from 'crypto';
import type { Ledger } from '../contract/out/contract/index.js';
export type IPv4 = { kind: 'ipv4'; address: string };
export type IPv6 = { kind: 'ipv6'; address: string };
export type IpAddress = IPv4 | IPv6;

export interface RegistryEntry {
  expiry: Date;
  ip: IpAddress;
  port: number;
}

export type ContractIpAddress = {
  is_left: boolean;
  left: Uint8Array;
  right: Uint8Array;
};

export type ContractEntry = {
  expiry: bigint;
  ip: ContractIpAddress;
  port: bigint;
};

export type RegistryKey = Uint8Array; // 32-byte
export type RegistrySecretKey = Uint8Array; // 64-byte

export type RegistryMapping = Map<string, RegistryEntry>;

export interface RegistryConstructorArgs {
  requiredCollateral: bigint;
  maxPeriod: bigint;
}

export function generateRandomSecretKey(): RegistrySecretKey {
  return crypto.randomBytes(64);
}

const SECRET_KEY_BYTES = 64;
const REGISTRY_KEY_BYTES = 32;

/**
 * Reads a hex-encoded secret key from a file, validating that it contains exactly 64 bytes.
 */
export function readSecretKeyFile(filePath: string): RegistrySecretKey {
  const hexStr = fs.readFileSync(filePath, 'utf-8').trim();
  const bytes = new Uint8Array(Buffer.from(hexStr, 'hex'));
  if (bytes.length !== SECRET_KEY_BYTES) {
    throw new Error(
      `Invalid secret key in "${filePath}": expected ${SECRET_KEY_BYTES} bytes (${SECRET_KEY_BYTES * 2} hex chars), got ${bytes.length}`
    );
  }
  return bytes;
}

/**
 * Parses a hex-encoded registry key string, validating that it is exactly 32 bytes.
 */
export function parseRegistryKeyHex(hex: string): RegistryKey {
  const bytes = new Uint8Array(Buffer.from(hex, 'hex'));
  if (bytes.length !== REGISTRY_KEY_BYTES) {
    throw new Error(
      `Invalid registry key: expected ${REGISTRY_KEY_BYTES} bytes (${REGISTRY_KEY_BYTES * 2} hex chars), got ${bytes.length}`
    );
  }
  return bytes;
}

export function timestampToDate(dateInString: string) {
  const expirySecs = Number(dateInString);

  if (!Number.isInteger(expirySecs) || expirySecs <= 0) {
    throw new Error(`Invalid expiry value: "${dateInString}". Expected a Unix timestamp in seconds.`);
  }

  return new Date(expirySecs * 1000);
}

export function ipToContract(ip: IpAddress): ContractIpAddress {
  if (ip.kind === 'ipv4') {
    const parts = ip.address.split('.');
    if (parts.length !== 4) {
      throw new Error(`Invalid IPv4 address: ${ip.address}`);
    }
    const bytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
      const n = Number(parts[i]);
      if (n < 0 || n > 255 || !Number.isInteger(n)) {
        throw new Error(`Invalid IPv4 octet: ${parts[i]}`);
      }
      bytes[i] = n;
    }
    return { is_left: true, left: bytes, right: new Uint8Array(16) };
  }

  // An IPv6 address is 8 groups of 16-bit values (128 bits total).
  // DataView.setUint16 writes each group as 2 big-endian bytes into the 16-byte buffer the contract expects.
  const expanded = expandIPv6(ip.address);
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  const groups = expanded.split(':');
  for (let i = 0; i < 8; i++) {
    view.setUint16(i * 2, parseInt(groups[i], 16));
  }
  return { is_left: false, left: new Uint8Array(4), right: bytes };
}

export function ipFromContract(raw: ContractIpAddress): IpAddress {
  if (raw.is_left) {
    const parts = Array.from(raw.left).map(String);
    return { kind: 'ipv4', address: parts.join('.') };
  }

  // Reverse of the encoding above: read each 16-bit group back from the 16-byte buffer and format as a hex string.
  const view = new DataView(raw.right.buffer, raw.right.byteOffset, raw.right.byteLength);
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) {
    groups.push(view.getUint16(i * 2).toString(16));
  }
  return { kind: 'ipv6', address: groups.join(':') };
}

export function entryToContract(entry: RegistryEntry): ContractEntry {
  return {
    expiry: BigInt(Math.floor(entry.expiry.getTime() / 1000)),
    ip: ipToContract(entry.ip),
    port: BigInt(entry.port),
  };
}

export function entryFromContract(raw: ContractEntry): RegistryEntry {
  return {
    expiry: new Date(Number(raw.expiry) * 1000),
    ip: ipFromContract(raw.ip),
    port: Number(raw.port),
  };
}

export function registryEntries(ledger: Ledger): { key: RegistryKey; entry: RegistryEntry }[] {
  return Array.from(ledger.registry, ([key, raw]) => ({
    key,
    entry: entryFromContract(raw),
  }));
}

function expandIPv6(address: string): string {
  const sides = address.split('::');
  if (sides.length > 2) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }

  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];

  if (sides.length === 2) {
    const missing = 8 - left.length - right.length;
    if (missing < 0) {
      throw new Error(`Invalid IPv6 address: ${address}`);
    }
    const middle = Array(missing).fill('0');
    return [...left, ...middle, ...right].map((g) => g.padStart(1, '0')).join(':');
  }

  if (left.length !== 8) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }
  return left.join(':');
}
