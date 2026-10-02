import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { encode } from 'cbor2';
import { asSet, BODY_FEE, BODY_INPUTS, BODY_OUTPUTS, type DecodedTx, encodeInput, encodeOutput } from './codec.js';
import type { TxInput, TxOutput } from './codec.js';
import { hashBody } from './subtx.js';

const WITS_VKEY = 0;

/** Shelley address header for a key payment credential with no delegation part. */
const ENTERPRISE_KEY_HEADER = 0x60;

export interface PaymentKey {
  /** The 32-byte ed25519 seed, as a cardano-cli `PaymentSigningKeyShelley_ed25519` holds it. */
  signingKey: Uint8Array;
  publicKey: Uint8Array;
  /** The payment credential: blake2b-224 of the public key. */
  keyHash: Uint8Array;
}

export function paymentKey(signingKey: Uint8Array): PaymentKey {
  const publicKey = ed25519.getPublicKey(signingKey);
  return { signingKey, publicKey, keyHash: blake2b(publicKey, { dkLen: 28 }) };
}

/** The address a key pays to when it has no stake part. `networkId` is 0 on every testnet. */
export function enterpriseAddress(keyHash: Uint8Array, networkId: number): Uint8Array {
  return Uint8Array.from([ENTERPRISE_KEY_HEADER | networkId, ...keyHash]);
}

/**
 * The payment key hash of a Shelley address, or undefined when a script or a Byron key controls
 * it. Header types 0, 2, 4 and 6 are the ones with a key in the payment part.
 */
export function paymentKeyHash(address: Uint8Array): Uint8Array | undefined {
  const type = address[0] >> 4;
  return type <= 6 && type % 2 === 0 ? address.slice(1, 29) : undefined;
}

/** A transaction in Dijkstra's mempool form, `[body, witnesses, auxiliary_data/nil]`, at a fee of zero. */
export function unsignedTx(inputs: TxInput[], outputs: TxOutput[]): DecodedTx {
  const body = new Map<number, unknown>([
    [BODY_INPUTS, asSet(inputs.map(encodeInput))],
    [BODY_OUTPUTS, outputs.map(encodeOutput)],
    [BODY_FEE, 0n],
  ]);
  return { items: [body, new Map(), null], body };
}

/** Replaces the transaction's witnesses with one per key, each signing the body's current encoding. */
export function signTx(tx: DecodedTx, keys: PaymentKey[]): Uint8Array {
  const bodyHash = hashBody(tx.body);
  const vkeys = keys.map((key) => [key.publicKey, ed25519.sign(bodyHash, key.signingKey)]);
  tx.items[1] = new Map([[WITS_VKEY, asSet(vkeys)]]);
  return encode(tx.items);
}
