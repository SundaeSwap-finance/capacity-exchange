/**
 * Translations from compact-runtime values into ledger-v8 types. Circuits run
 * in the onchain-runtime wasm module while the transaction builder lives in
 * the separate ledger-v8 module, which only accepts its own objects. The two
 * agree on serialized bytes and plain data, so contract state round-trips
 * through serialization and plain values are re-typed.
 */
import {
  ContractState,
  decodeShieldedCoinInfo,
  decodeQualifiedShieldedCoinInfo,
  type Op,
  type AlignedValue,
  type ShieldedCoinInfo,
  type QualifiedShieldedCoinInfo,
} from '@midnight-ntwrk/ledger-v8';
import type { ProofData } from '@midnight-ntwrk/compact-runtime';
import type { EncodedInput, EncodedOutput } from './leg.js';

/** ProofData's fields as ledger-v8 consumes them. */
interface LedgerProofData {
  publicTranscript: Op<AlignedValue>[];
  privateTranscriptOutputs: AlignedValue[];
  input: AlignedValue;
  output: AlignedValue;
}

/** compact-runtime declares the same data with its own types, so this is the
 *  one re-type at the boundary. */
export const asLedgerProofData = (proofData: ProofData) => proofData as unknown as LedgerProofData;

/** Re-materialize serialized onchain-runtime contract state as ledger state. */
export const toLedgerContractState = (serialized: Uint8Array): ContractState => ContractState.deserialize(serialized);

/** A circuit-produced coin in the hex form ledger-v8 wants. */
export const toLedgerCoin = (coinInfo: EncodedOutput['coinInfo']): ShieldedCoinInfo => decodeShieldedCoinInfo(coinInfo);

/** A circuit-claimed spend as a transient's source coin: created in this same
 *  transaction, so it has no chain tree index. */
export const toLedgerTransientCoin = (spend: EncodedInput): QualifiedShieldedCoinInfo =>
  decodeQualifiedShieldedCoinInfo({ ...spend, mt_index: 0n });
