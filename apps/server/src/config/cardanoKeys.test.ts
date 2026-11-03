import { describe, it, expect } from 'vitest';
import { createPublicKey, sign, verify } from 'crypto';
import { fileURLToPath } from 'url';
import { readSigningKeyFile } from './cardanoKeys.js';

// testnet/cardano/server.skey, and its public key.
const SKEY_FILE = fileURLToPath(
  new URL('../../../../testnet/cardano/server.skey', import.meta.url),
);
const VKEY_HEX = '0db194fa0f6c49b1a4e3a8b5c6ea075b198fecad18b5197d822255575af3c8fd';

describe('readSigningKeyFile', () => {
  it('derives the public key from a cardano-cli signing key', () => {
    expect(Buffer.from(readSigningKeyFile(SKEY_FILE).publicKey).toString('hex')).toBe(VKEY_HEX);
  });

  it('reads a private key that signs with Ed25519 under that public key', () => {
    const { privateKey, publicKey } = readSigningKeyFile(SKEY_FILE);
    const message = Buffer.from('hints');
    const signature = sign(null, message, privateKey);
    expect(signature).toHaveLength(64);
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKey).toString('base64url') },
      format: 'jwk',
    });
    expect(verify(null, message, key, signature)).toBe(true);
  });

  it('names the file it cannot read', () => {
    expect(() => readSigningKeyFile('missing.skey')).toThrow('missing.skey');
  });
});
