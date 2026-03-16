// TODO(SUNDAE-2456): Replace throws with result types across hexToBytes/parseHex
// so callers can handle errors without try/catch indirection.
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error(`Invalid hex: odd length (${cleaned.length})`);
  }
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error('Invalid hex: contains non-hex characters');
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// TODO(SUNDAE-2456): Replace throws with result types across hexToBytes/parseHex
/** Parse a hex string and validate it has the expected byte length. */
export function parseHex(hex: string, expectedBytes: number, label: string): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length !== expectedBytes) {
    throw new Error(`${label}: expected ${expectedBytes} bytes, got ${bytes.length}`);
  }
  return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
