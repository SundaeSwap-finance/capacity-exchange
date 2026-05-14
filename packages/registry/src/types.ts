import type { Ledger } from '../contract/out/contract/index.js';

/** SRV service prefix used to identify Capacity Exchange servers. */
export const SRV_SERVICE_PREFIX = '_capacityexchange._tcp.';

declare const __domain: unique symbol;
declare const __srv: unique symbol;

export type DomainName = string & { readonly [__domain]: never };
export type SrvName = string & { readonly [__srv]: never };

export interface RegistryEntry {
  expiry: Date;
  /** Domain name registered on-chain (e.g. `example.com`). */
  domainName: DomainName;
}

export type ContractEntry = {
  expiry: bigint;
  domainName: Uint8Array; // DomainName bytes (128)
};

export type RegistryKey = Uint8Array; // 32-byte
export type RegistrySecretKey = Uint8Array; // 64-byte

export type RegistryMapping = Map<string, RegistryEntry>;

export interface RegistryConstructorArgs {
  requiredCollateral: bigint;
  maxPeriod: bigint;
}

export function generateRandomSecretKey(): RegistrySecretKey {
  return globalThis.crypto.getRandomValues(new Uint8Array(64));
}

const REGISTRY_KEY_BYTES = 32;

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

/**
 * Parses a bare domain name (e.g. `example.com`) into the opaque {@link DomainName} branded type.
 */
export function toDomainName(raw: string): DomainName {
  const s = raw.trim().toLowerCase();
  if (s.startsWith(SRV_SERVICE_PREFIX)) {
    throw new Error('expected bare domain, got SRV name');
  }
  // todo: validate domain name format more robustly
  return s as DomainName;
}

export function toSrvName(d: DomainName): SrvName {
  return `${SRV_SERVICE_PREFIX}${d}` as SrvName;
}

const DOMAIN_NAME_MAX_BYTES = 128;

export function domainNameToContract(domainName: DomainName): Uint8Array {
  if (domainName.length === 0) {
    throw new Error('Domain name cannot be empty');
  }

  const encoded = new TextEncoder().encode(domainName);
  if (encoded.length > DOMAIN_NAME_MAX_BYTES) {
    throw new Error(`Domain name too long: ${encoded.length} bytes (max ${DOMAIN_NAME_MAX_BYTES})`);
  }

  const bytes = new Uint8Array(DOMAIN_NAME_MAX_BYTES);
  bytes.set(encoded);
  return bytes;
}

export function domainNameFromContract(raw: Uint8Array): DomainName {
  // Strip trailing zero bytes and decode the domain name string.
  let end = raw.length;
  while (end > 0 && raw[end - 1] === 0) {
    end--;
  }

  const _domainName = new TextDecoder().decode(raw.subarray(0, end));
  return toDomainName(_domainName);
}

export function entryToContract(entry: RegistryEntry): ContractEntry {
  return {
    expiry: BigInt(Math.floor(entry.expiry.getTime() / 1000)),
    domainName: domainNameToContract(entry.domainName),
  };
}

export function entryFromContract(raw: ContractEntry): RegistryEntry {
  return {
    expiry: new Date(Number(raw.expiry) * 1000),
    domainName: domainNameFromContract(raw.domainName),
  };
}

export function registryEntries(ledger: Ledger): { key: RegistryKey; entry: RegistryEntry }[] {
  return Array.from(ledger.registry, ([key, raw]) => ({
    key,
    entry: entryFromContract(raw),
  }));
}
