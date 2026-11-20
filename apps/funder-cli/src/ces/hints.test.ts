import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { encodeHints, encodeHintsBody, type HintsBody } from '@capacity-exchange/cardano-core';
import { adaPrices, decodeHints, priceFor } from './hints.js';
import { bytesToHex } from '../tx/codec.js';

const UNIT = 'f0859b924e5a842cab5308654d5d703a6b736ca6ea6085cd32bac9a174657374';

function signed(body: HintsBody, secret: Uint8Array): string {
  const bytes = encodeHintsBody(body);
  return bytesToHex(encodeHints(bytes, ed25519.sign(bytes, secret)));
}

describe('hints', () => {
  const secret = ed25519.utils.randomSecretKey();
  const body: HintsBody = {
    producedAt: 1795212109636n,
    prices: [
      {
        paid: { type: 'native', unit: UNIT },
        spent: { type: 'ada' },
        base: 101n,
        ladder: [
          { supply: 1_000_000n, perUnit: { numerator: 11n, denominator: 1000n } },
          { supply: null, perUnit: { numerator: 1n, denominator: 3n } },
        ],
      },
    ],
    registration: new Uint8Array(28).fill(7),
    issuerVkey: ed25519.getPublicKey(secret),
  };

  it("decodes what the server's encoder writes", () => {
    expect(decodeHints(signed(body, secret)).body).toEqual(body);
  });

  it('refuses a set whose signature is not the issuer key’s', () => {
    const other = ed25519.utils.randomSecretKey();
    expect(() => decodeHints(signed(body, other))).toThrow(/signature/);
  });

  it('prices up the ladder and rounds up once, as the server does', () => {
    const [price] = adaPrices(body);
    expect(priceFor(price, 1_000_000n)).toBe(101n + 11_000n);
    // 11000 + 1/3 → rounds up to 11001
    expect(priceFor(price, 1_000_001n)).toBe(101n + 11_001n);
    expect(priceFor({ ...price, ladder: price.ladder.slice(0, 1) }, 1_000_001n)).toBeUndefined();
  });
});

describe('extended payment keys', () => {
  it('sign with kL as the scalar, giving ordinary ed25519 signatures', async () => {
    const { extendedSigner } = await import('../tx/subtx.js');
    const xprv = new Uint8Array(64).map((_, i) => (i * 37 + 11) & 0xff);
    xprv[0] &= 248;
    xprv[31] = (xprv[31] & 63) | 64;
    const signer = extendedSigner(xprv);
    const scalar = BigInt(`0x${bytesToHex(xprv.subarray(0, 32).slice().reverse())}`);
    expect(bytesToHex(signer.publicKey)).toBe(
      bytesToHex(ed25519.Point.BASE.multiply(scalar % ed25519.Point.Fn.ORDER).toBytes())
    );
    const message = new Uint8Array(32).fill(3);
    expect(ed25519.verify(signer.sign(message), message, signer.publicKey)).toBe(true);
  });
});
