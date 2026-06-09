import { persistentCommit, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';
import { hexToBytes, uint8ArrayToHex } from './hex.js';

function toZeroPadded32Bytes(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

const DERIVE_TOKEN_PROTOCOL_CONSTANT = toZeroPadded32Bytes('midnight:derive_token');

/** Strips the "unshielded-<networkId>" prefix from an encoded color
 * to get the bare 32-byte hex RawTokenType.
 * */
export function toRawTokenType(rawId: string): string {
  return rawId.slice(-64);
}

export function deriveTokenColor(tokenColorHex: string, contractAddress: string): string {
  const contractAddressBytes = hexToBytes(contractAddress);
  const tokenColorBytes = hexToBytes(tokenColorHex);

  const bytes32Descriptor = new CompactTypeBytes(32);
  const vectorDescriptor = new CompactTypeVector(2, bytes32Descriptor);

  const commitInput = [tokenColorBytes, contractAddressBytes];

  const derivedTokenColor = persistentCommit(vectorDescriptor, commitInput, DERIVE_TOKEN_PROTOCOL_CONSTANT);
  return uint8ArrayToHex(derivedTokenColor);
}
