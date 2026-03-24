// Contract-specific Schnorr signing for the Vault contract.

import { EMBEDDED_CURVE_ORDER, type KeyPair, type SchnorrSignature, sign as schnorrSign } from './schnorr.js';
import type { JubjubPoint } from '@midnight-ntwrk/compact-runtime';

/** A Schnorr signature packaged with the extra data the Vault contract needs to verify it. */
export interface VaultSignResult {
  /** The standard Schnorr signature (R, s). */
  signature: SchnorrSignature;
  /** floor(e / EMBEDDED_CURVE_ORDER) — the contract uses this to reduce the challenge
   *  e mod EMBEDDED_CURVE_ORDER, since Compact lacks modular arithmetic for ~252-bit values. */
  challengeQuotient: bigint;
}

/** Sign a message, producing a signature and challengeQuotient for on-chain verification. */
export function vaultSign(sk: bigint, pk: JubjubPoint, message: bigint): VaultSignResult {
  const { signature, challenge } = schnorrSign(sk, pk, message);
  const challengeQuotient = challenge / EMBEDDED_CURVE_ORDER;
  return { signature, challengeQuotient };
}

/** Sign a message with multiple key pairs for on-chain verification. */
export function vaultSignMultisig(keyPairs: KeyPair[], message: bigint): VaultSignResult[] {
  return keyPairs.map((kp) => vaultSign(kp.secretKey, kp.publicKey, message));
}
