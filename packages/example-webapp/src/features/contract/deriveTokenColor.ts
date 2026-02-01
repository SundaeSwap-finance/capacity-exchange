import { persistentCommit, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';

function toZeroPadded32Bytes(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const DERIVE_TOKEN_PROTOCOL_CONSTANT = toZeroPadded32Bytes('midnight:derive_token');

/**
 * Derives the token color that appears in wallets from the base token color and contract address.
 * This is browser-compatible (no Node.js Buffer).
 */
export function deriveTokenColor(tokenColorHex: string, contractAddress: string): string {
  const contractAddressBytes = hexToBytes(contractAddress);
  const tokenColorBytes = hexToBytes(tokenColorHex);

  const bytes32Descriptor = new CompactTypeBytes(32);
  const vectorDescriptor = new CompactTypeVector(2, bytes32Descriptor);

  const commitInput = [new Uint8Array(tokenColorBytes), new Uint8Array(contractAddressBytes)];

  const derivedTokenColor = persistentCommit(vectorDescriptor, commitInput, DERIVE_TOKEN_PROTOCOL_CONSTANT);
  return bytesToHex(new Uint8Array(derivedTokenColor));
}
