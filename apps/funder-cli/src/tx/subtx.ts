import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
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

/** Reads a cardano-cli PaymentSigningKeyShelley_ed25519 file down to its 32-byte seed. */
export function readSigningKey(path: string): Uint8Array {
  const envelope = JSON.parse(readFileSync(path, 'utf8')) as { type: string; cborHex: string };
  if (!envelope.cborHex) {
    throw new Error(`${path} is not a cardano-cli signing key file`);
  }
  if (envelope.type?.includes('Extended')) {
    throw new Error(`${path} is an extended key; this tool only supports plain ed25519 payment keys`);
  }
  const seed = new Serialization.CborReader(HexBlob(envelope.cborHex)).readByteString();
  if (seed.length !== 32) {
    throw new Error(`Expected a 32-byte signing key, got ${seed.length} bytes`);
  }
  return seed;
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
export function signSubTransaction(body: SubTransactionBody, signingKey: Uint8Array): SubTransaction {
  const unsigned = new SubTransaction(body, new Serialization.TransactionWitnessSet());
  const bodyHash = hexToBytes(unsigned.getId());
  const witness = [
    bytesToHex(ed25519.getPublicKey(signingKey)),
    bytesToHex(ed25519.sign(bodyHash, signingKey)),
  ] as VkeyWitnessEntry;
  const vkeys = Serialization.CborSet.fromCore([witness], Serialization.VkeyWitness.fromCore);
  const witnesses = new Serialization.TransactionWitnessSet();
  witnesses.setVkeys(vkeys);
  // Re-parse so the result pins the exact bytes that were signed, as an arriving offer would.
  return SubTransaction.fromCbor(new SubTransaction(body, witnesses).toCbor());
}

/** The vkeys that signed a sub-transaction, for display. */
export function subTransactionSigners(sub: SubTransaction): string[] {
  return (sub.witnessSet().vkeys()?.values() ?? []).map((w) => w.vkey());
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
