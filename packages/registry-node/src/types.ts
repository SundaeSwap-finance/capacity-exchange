import { RegistryKey, RegistrySecretKey } from '@sundaeswap/capacity-exchange-registry';

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
