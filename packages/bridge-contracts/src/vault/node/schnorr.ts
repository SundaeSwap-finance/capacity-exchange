// Generic Schnorr signature primitives over Midnight's embedded elliptic curve (JubJub).

import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  ecMulGenerator,
  transientHash,
  CompactTypeField,
  CompactTypeJubjubPoint,
  type JubjubPoint,
} from '@midnight-ntwrk/compact-runtime';

// The embedded curve's prime-order subgroup order (r). ecMulGenerator and ecMul operate on
// this curve, so scalars must be in [0, EMBEDDED_CURVE_ORDER). Values >= this are rejected.
//
// Midnight uses BLS12-381 and JubJub (a twisted Edwards curve embedded over the BLS12-381
// scalar field).
//   Verify: BigInt("0x0e7db4ea6533afa906673b0101343b00a6682093ccc81082d0970e5ed6f72cb7")
//        === 6554484396890773809930967563523245729705921265872317281365359162392183254199n
//   Sources:
//     - Midnight ZK repo ("curves: Implementation of elliptic curves used in midnight,
//       concretely BLS12-381 and JubJub"):
//       https://github.com/midnightntwrk/midnight-zk/blob/main/README.md
//     - zkcrypto/jubjub scalar field (Fr) definition:
//       https://github.com/zkcrypto/jubjub/blob/main/src/fr.rs
export const EMBEDDED_CURVE_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;

// Tuple descriptor for [JubjubPoint, JubjubPoint, Field], matching the layout used by
// transientHash<[JubjubPoint, JubjubPoint, Field]>([R, pubKey, message]) in the Vault contract.
const schnorrHashDescriptor = {
  alignment() {
    return CompactTypeJubjubPoint.alignment().concat(
      CompactTypeJubjubPoint.alignment().concat(CompactTypeField.alignment())
    );
  },
  // Required by CompactType interface but unused — transientHash only calls toValue/alignment.
  fromValue(value: Uint8Array[]): [JubjubPoint, JubjubPoint, bigint] {
    return [
      CompactTypeJubjubPoint.fromValue(value),
      CompactTypeJubjubPoint.fromValue(value),
      CompactTypeField.fromValue(value),
    ];
  },
  toValue(value: [JubjubPoint, JubjubPoint, bigint]) {
    return CompactTypeJubjubPoint.toValue(value[0]).concat(
      CompactTypeJubjubPoint.toValue(value[1]).concat(CompactTypeField.toValue(value[2]))
    );
  },
};

/** A Schnorr key pair on the embedded curve. */
export interface KeyPair {
  /** Random scalar in [1, EMBEDDED_CURVE_ORDER) — must be kept secret. */
  secretKey: bigint;
  /** sk·G — safe to share publicly. */
  publicKey: JubjubPoint;
}

/** A Schnorr signature proving knowledge of a secret key for a given message. */
export interface SchnorrSignature {
  /** R = k·G — a curve point derived from the random nonce k */
  r: JubjubPoint;
  /** s = k + e·sk — combines the nonce with the secret key, bound to the message via e */
  s: bigint;
}

/**
 * Generate a random scalar in [1, EMBEDDED_CURVE_ORDER).
 *
 * Used to pick the nonce k for each signature. k MUST be:
 *  - cryptographically random
 *  - non-zero (k=0 means R is the point at infinity)
 *  - never reused, as that would leak the secret key
 */
export function randomScalar(): bigint {
  let s: bigint;
  do {
    s = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % EMBEDDED_CURVE_ORDER;
  } while (s === 0n);
  return s;
}

/** Generate a random Schnorr key pair. */
export function generateKeyPair(): KeyPair {
  const sk = randomScalar();
  const pk = ecMulGenerator(sk);
  return { secretKey: sk, publicKey: pk };
}

/** The output of signing: the signature itself plus the raw challenge hash. */
export interface SignResult {
  /** The (R, s) pair that proves knowledge of the secret key. */
  signature: SchnorrSignature;
  /** The raw challenge e = H(R, pk, message) before reduction mod EMBEDDED_CURVE_ORDER. */
  challenge: bigint;
}

/** Sign a message, producing a standard Schnorr signature. */
export function sign(sk: bigint, pk: JubjubPoint, message: bigint): SignResult {
  const k = randomScalar();
  const R = ecMulGenerator(k);
  const e = transientHash(schnorrHashDescriptor, [R, pk, message]);
  const eReduced = e % EMBEDDED_CURVE_ORDER;
  const s = (k + eReduced * sk) % EMBEDDED_CURVE_ORDER;
  return { signature: { r: R, s }, challenge: e };
}

/** Sign a message with multiple key pairs. */
export function signMultisig(keyPairs: KeyPair[], message: bigint): SignResult[] {
  return keyPairs.map((kp) => sign(kp.secretKey, kp.publicKey, message));
}

/** Load key pairs from a JSON file written by generate-keys. */
export function loadKeyPairs(filePath: string): KeyPair[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return raw.map((entry: { secretKey: string; publicKey: { x: string; y: string } }) => ({
    secretKey: BigInt(entry.secretKey),
    publicKey: {
      x: BigInt(entry.publicKey.x),
      y: BigInt(entry.publicKey.y),
    },
  }));
}
