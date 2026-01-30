import { persistentCommit, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';

function toZeroPadded32Bytes(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

const DERIVE_TOKEN_PROTOCOL_CONSTANT = toZeroPadded32Bytes('midnight:derive_token');

export function deriveTokenColor(tokenColorHex: string, contractAddress: string): string {
  const contractAddressBytes = Buffer.from(contractAddress, 'hex');
  const tokenColorBytes = Buffer.from(tokenColorHex, 'hex');

  const bytes32Descriptor = new CompactTypeBytes(32);
  const vectorDescriptor = new CompactTypeVector(2, bytes32Descriptor);

  const commitInput = [new Uint8Array(tokenColorBytes), new Uint8Array(contractAddressBytes)];

  const derivedTokenColor = persistentCommit(vectorDescriptor, commitInput, DERIVE_TOKEN_PROTOCOL_CONSTANT);
  return Buffer.from(derivedTokenColor).toString('hex');
}
