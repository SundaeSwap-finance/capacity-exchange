import { describe, expect, it } from 'vitest';
import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { decode } from 'cbor2';
import { settleFee } from './batch.js';
import { asArray, BODY_FEE, bytesToHex, readOutputs, BODY_OUTPUTS } from './codec.js';
import { hashBody } from './subtx.js';
import { enterpriseAddress, paymentKey, paymentKeyHash, signTx, unsignedTx } from './tx.js';

const KEY = paymentKey(new Uint8Array(32).fill(7));
const PARAMS = { txFeeFixed: 155_381n, txFeePerByte: 44n, utxoCostPerByte: 4310n };
const IN = { txHash: 'a1'.repeat(32), index: 0 };

describe('payment keys and addresses', () => {
  it('hashes the public key to the 28-byte credential', () => {
    expect(bytesToHex(KEY.keyHash)).toBe(bytesToHex(blake2b(KEY.publicKey, { dkLen: 28 })));
  });

  it('builds an enterprise address whose payment part is the key hash', () => {
    const address = enterpriseAddress(KEY.keyHash, 0);
    expect(address[0]).toBe(0x60);
    expect(address).toHaveLength(29);
    expect(bytesToHex(paymentKeyHash(address)!)).toBe(bytesToHex(KEY.keyHash));
  });

  it('finds no payment key in a script address', () => {
    expect(paymentKeyHash(Uint8Array.from([0x70, ...KEY.keyHash]))).toBeUndefined();
  });
});

describe('a plain payment', () => {
  function payment() {
    const address = enterpriseAddress(KEY.keyHash, 0);
    const tx = unsignedTx(
      [IN],
      [
        { address, value: { lovelace: 3_000_000n, assets: new Map() } },
        { address, value: { lovelace: 7_000_000n, assets: new Map() } },
      ]
    );
    return { tx, settled: settleFee({ tx, changeIndex: 1, ...PARAMS, witnessCount: 1 }) };
  }

  it('takes the fee out of the change, so inputs equal outputs plus fee', () => {
    const { tx, settled } = payment();
    const outputs = readOutputs(tx.body, BODY_OUTPUTS);
    expect(outputs[0].value.lovelace).toBe(3_000_000n);
    expect(outputs[1].value.lovelace + settled.fee).toBe(7_000_000n);
    expect(tx.body.get(BODY_FEE)).toBe(settled.fee);
  });

  it('pays the minimum fee for its signed size exactly', () => {
    const { tx, settled } = payment();
    const signed = signTx(tx, [KEY]);
    expect(signed.length).toBe(settled.signedSizeBytes);
    expect(settled.fee).toBe(PARAMS.txFeeFixed + BigInt(signed.length) * PARAMS.txFeePerByte);
  });

  it('carries one witness that verifies against the body hash', () => {
    const { tx } = payment();
    const [, wits, aux] = decode(signTx(tx, [KEY])) as [unknown, Map<number, unknown>, unknown];
    const [[vkey, signature]] = asArray(wits.get(0)) as Uint8Array[][];
    expect(aux).toBeNull();
    expect(bytesToHex(vkey)).toBe(bytesToHex(KEY.publicKey));
    expect(ed25519.verify(signature, hashBody(tx.body), vkey)).toBe(true);
  });

  it('refuses change that cannot cover the fee and its minimum', () => {
    const address = enterpriseAddress(KEY.keyHash, 0);
    const tx = unsignedTx([IN], [{ address, value: { lovelace: 900_000n, assets: new Map() } }]);
    expect(() => settleFee({ tx, changeIndex: 0, ...PARAMS, witnessCount: 1 })).toThrow(/below its/);
  });
});
