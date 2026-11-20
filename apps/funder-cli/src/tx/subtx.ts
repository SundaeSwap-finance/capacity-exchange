import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToNumberLE, concatBytes, numberToBytesLE } from '@noble/curves/utils.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { SubTransaction } from '@capacity-exchange/cardano-core';
import { Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import { readFileSync } from 'node:fs';
import type { Value } from '../cardano/value.js';
import { subValue, sumValues } from '../cardano/value.js';
import {
  bytesToHex,
  cborSize,
  hexToBytes,
  inputSet,
  outputValue,
  type SubTransactionBody,
  type TxInput,
  type TxOutput,
  withValue,
} from './codec.js';

export { SubTransaction };

type VkeyWitnessEntry = ReturnType<Serialization.VkeyWitness['toCore']>;

/** The ledger's min-UTxO formula for Babbage onwards: (160 + |output|) * coinsPerUTxOByte. */
const MIN_UTXO_OVERHEAD = 160n;

/** A payment key that can witness a sub-transaction. */
export interface Signer {
  publicKey: Uint8Array;
  sign(message: Uint8Array): Uint8Array;
}

/** A plain ed25519 key, from its 32-byte seed. */
export function plainSigner(seed: Uint8Array): Signer {
  return { publicKey: ed25519.getPublicKey(seed), sign: (message) => ed25519.sign(message, seed) };
}

/**
 * A BIP32-Ed25519 extended key, as HD wallets derive them, from its 64-byte `kL ‖ kR`. Unlike
 * a plain key, `kL` is already the scalar rather than a seed hashed into one, and `kR` stands
 * in for the hash's upper half as the nonce source. Its signatures are ordinary ed25519 ones.
 */
export function extendedSigner(xprv: Uint8Array): Signer {
  const { Point } = ed25519;
  const order = Point.Fn.ORDER;
  const kL = xprv.subarray(0, 32);
  const kR = xprv.subarray(32, 64);
  const scalar = bytesToNumberLE(kL) % order;
  const publicKey = Point.BASE.multiply(scalar).toBytes();
  const hashToScalar = (...parts: Uint8Array[]) => bytesToNumberLE(sha512(concatBytes(...parts))) % order;
  return {
    publicKey,
    sign(message) {
      const r = hashToScalar(kR, message);
      const R = Point.BASE.multiply(r).toBytes();
      const k = hashToScalar(R, publicKey, message);
      return concatBytes(R, numberToBytesLE((r + k * scalar) % order, 32));
    },
  };
}

/**
 * Reads a cardano-cli payment signing key file: a plain `PaymentSigningKeyShelley_ed25519`, or
 * a `PaymentExtendedSigningKeyShelley_ed25519_bip32`, as HD wallets export.
 */
export function readSigningKey(path: string): Signer {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as { type: string; cborHex: string };
  if (!envelope.cborHex) {
    throw new Error(`${path} is not a cardano-cli signing key file`);
  }
  const bytes = new Serialization.CborReader(HexBlob(envelope.cborHex)).readByteString();
  if (envelope.type?.includes('Extended')) {
    // `kL ‖ kR`, then the chain code (and in some exports the public key), which signing never needs.
    if (bytes.length < 64) {
      throw new Error(`Expected an extended signing key of at least 64 bytes, got ${bytes.length}`);
    }
    return extendedSigner(bytes.subarray(0, 64));
  }
  if (bytes.length !== 32) {
    throw new Error(`Expected a 32-byte signing key, got ${bytes.length} bytes`);
  }
  return plainSigner(bytes);
}

/** Blake2b-224 of a vkey: what an address's payment part holds. */
export function keyHash(vkeyHex: string): string {
  return bytesToHex(blake2b(hexToBytes(vkeyHex), { dkLen: 28 }));
}

/** Minimum lovelace an output must carry, given how large it serialises. */
export function minUtxoLovelace(output: TxOutput, utxoCostPerByte: bigint): bigint {
  // The amount feeds back into the size, so settle it in two passes.
  let candidate = output;
  let result = 0n;
  for (let pass = 0; pass < 2; pass++) {
    const size = BigInt(cborSize(candidate.toCbor()));
    result = (MIN_UTXO_OVERHEAD + size) * utxoCostPerByte;
    candidate = withValue(output, { ...outputValue(output), lovelace: result });
  }
  return result;
}

/**
 * The body of the caller's offer: their own UTxO in, and the outputs they want out.
 *
 * It deliberately does not balance. The outputs carry more lovelace than the input — the
 * change output's minimum, which the caller cannot fund — and fewer tokens, the difference
 * being the price. The ledger only checks conservation across the whole batch, so whoever
 * carries the offer makes up the lovelace and keeps the tokens.
 */
export function buildOfferBody(inputs: TxInput[], outputs: TxOutput[]): SubTransactionBody {
  return new Serialization.SubTransactionBody(inputSet(inputs), outputs);
}

/**
 * Signs a sub-transaction body. The hash a witness signs is the sub-transaction's own body
 * hash, not the batch's, which is what lets the caller sign an offer before anyone has built
 * the transaction that will carry it.
 */
export function signSubTransaction(body: SubTransactionBody, key: Uint8Array | Signer): SubTransaction {
  const signer = key instanceof Uint8Array ? plainSigner(key) : key;
  const unsigned = new SubTransaction(body, new Serialization.TransactionWitnessSet());
  const bodyHash = hexToBytes(unsigned.getId());
  const witness = [bytesToHex(signer.publicKey), bytesToHex(signer.sign(bodyHash))] as VkeyWitnessEntry;
  const vkeys = Serialization.CborSet.fromCore([witness], Serialization.VkeyWitness.fromCore);
  const witnesses = new Serialization.TransactionWitnessSet();
  witnesses.setVkeys(vkeys);
  // Re-parse so the result pins the exact bytes that were signed, as an arriving offer would.
  return SubTransaction.fromCbor(new SubTransaction(body, witnesses).toCbor());
}

/**
 * Checks every vkey witness against the body hash, returning the signing keys. An offer with
 * no witnesses at all is refused: it would be carried on nobody's authority.
 */
export function verifyWitnesses(sub: SubTransaction): string[] {
  const vkeys = sub.witnessSet().vkeys()?.values() ?? [];
  if (vkeys.length === 0) {
    throw new Error('Sub-transaction carries no vkey witnesses');
  }
  const message = hexToBytes(sub.getId());
  return vkeys.map((w) => {
    if (!ed25519.verify(hexToBytes(w.signature()), message, hexToBytes(w.vkey()))) {
      throw new Error(`Witness from ${w.vkey().slice(0, 8)}… does not verify against the body hash`);
    }
    return w.vkey();
  });
}

/**
 * CIP-0198's imbalance: `consumed − produced`, per asset. A positive entry is what the
 * sub-transaction offers its batch, a negative one what it needs from it. For a babel-fee
 * offer the tokens come out positive and the lovelace negative.
 */
export function imbalance(sub: SubTransaction, resolveInput: (input: TxInput) => Value): Value {
  const body = sub.body();
  const consumed = sumValues(body.inputs().values().map(resolveInput));
  const produced = sumValues(body.outputs().map(outputValue));
  return subValue(consumed, produced);
}
