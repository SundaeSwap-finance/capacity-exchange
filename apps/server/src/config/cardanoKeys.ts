import { createPrivateKey, createPublicKey, type KeyObject } from 'crypto';
import { readFileOrError } from './files.js';

export interface Ed25519KeyPair {
  privateKey: KeyObject;
  /** The raw Ed25519 public key, 32 bytes. */
  publicKey: Uint8Array;
}

// PKCS#8 wrapping of a raw Ed25519 seed, which is how Node's crypto takes a private key.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Reads a cardano-cli `PaymentSigningKeyShelley_ed25519` text envelope. */
export function readSigningKeyFile(path: string): Ed25519KeyPair {
  const envelope = JSON.parse(readFileOrError(path, 'Failed to read signing key')) as {
    type?: string;
    cborHex?: string;
  };
  if (envelope.type !== 'PaymentSigningKeyShelley_ed25519' || !envelope.cborHex) {
    throw new Error(`${path} is not a cardano-cli PaymentSigningKeyShelley_ed25519 key`);
  }
  // The CBOR of a 32-byte string: header 0x5820, then the Ed25519 seed.
  if (!/^5820[0-9a-fA-F]{64}$/.test(envelope.cborHex)) {
    throw new Error(`${path} does not hold a 32-byte Ed25519 seed`);
  }
  const seed = Buffer.from(envelope.cborHex.slice(4), 'hex');
  return seedToSigningKey(seed);
}

export function seedToSigningKey(seed: Uint8Array): Ed25519KeyPair {
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  const x = createPublicKey(privateKey).export({ format: 'jwk' }).x!;
  return { privateKey, publicKey: new Uint8Array(Buffer.from(x, 'base64url')) };
}
