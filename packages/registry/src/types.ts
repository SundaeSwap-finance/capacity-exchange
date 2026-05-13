import type { Ledger } from '../contract/out/contract/index.js';

/** SRV service prefix used to identify Capacity Exchange servers. */
export const SRV_SERVICE_PREFIX = '_capacityexchange._tcp.';

export interface RegistryEntry {
  expiry: Date;
  /** SRV record name resolved by clients via DNS to obtain host and port. */
  address: string;
}

export type ContractEntry = {
  expiry: bigint;
  address: Uint8Array; // SrvName bytes (256)
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

const SRV_MAX_BYTES = 256;

export function serverAddressToContract(address: string): Uint8Array {
  if (address.length === 0) {
    throw new Error('Address cannot be empty');
  }

  const encoded = new TextEncoder().encode(address);
  if (encoded.length > SRV_MAX_BYTES) {
    throw new Error(`SRV name too long: ${encoded.length} bytes (max ${SRV_MAX_BYTES})`);
  }

  const bytes = new Uint8Array(SRV_MAX_BYTES);
  bytes.set(encoded);
  return bytes;
}

export function serverAddressFromContract(raw: Uint8Array): string {
  // Strip trailing zero bytes and decode the SRV name string.
  let end = raw.length;
  while (end > 0 && raw[end - 1] === 0) {
    end--;
  }
  return new TextDecoder().decode(raw.subarray(0, end));
}

export function entryToContract(entry: RegistryEntry): ContractEntry {
  return {
    expiry: BigInt(Math.floor(entry.expiry.getTime() / 1000)),
    address: serverAddressToContract(entry.address),
  };
}

export function entryFromContract(raw: ContractEntry): RegistryEntry {
  return {
    expiry: new Date(Number(raw.expiry) * 1000),
    address: serverAddressFromContract(raw.address),
  };
}

export function registryEntries(ledger: Ledger): { key: RegistryKey; entry: RegistryEntry }[] {
  return Array.from(ledger.registry, ([key, raw]) => ({
    key,
    entry: entryFromContract(raw),
  }));
}
