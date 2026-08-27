import {
  type Transaction,
  type SignatureEnabled,
  type Proof,
  type Binding,
  type AlignedValue,
  type ContractAction,
  type ContractCall,
  type Transcript,
} from '@midnight-ntwrk/ledger-v8';
import { mergeCellWrites } from './cellWrites.js';

/** A transaction that has been signed, proved, and bound. */
export type FinalizedTransaction = Transaction<SignatureEnabled, Proof, Binding>;

/** Whether this is a call to the given contract. Deploys and updates are excluded, since only
 *  calls carry the record of what ran. */
function isCallTo(action: ContractAction<Proof>, address: string): action is ContractCall<Proof> {
  return 'guaranteedTranscript' in action && action.address === address;
}

/** Every call to the given contract, across all of a transaction's intents. */
export function callsTo(tx: FinalizedTransaction, address: string): ContractCall<Proof>[] {
  return [...(tx.intents?.values() ?? [])]
    .flatMap((intent) => intent.actions)
    .filter((action): action is ContractCall<Proof> => isCallTo(action, address));
}

/** Which function of the contract was called. */
export function entryPointOf(call: ContractCall<Proof>): string {
  return typeof call.entryPoint === 'string' ? call.entryPoint : new TextDecoder().decode(call.entryPoint);
}

/** The record of what a call did. There are two of them because the ledger splits execution
 *  into a part that always applies and a part that can be rolled back. */
function transcriptsOf(call: ContractCall<Proof>): Transcript<AlignedValue>[] {
  return [call.guaranteedTranscript, call.fallibleTranscript].filter((t) => t != null);
}

/** Every 32-byte field a call wrote, by slot number. */
export function cellWritesBySlot(call: ContractCall<Proof>): Map<number, Uint8Array> {
  return mergeCellWrites(call.guaranteedTranscript?.program, call.fallibleTranscript?.program);
}

/** The coins a call created. */
export function mintedTokens(call: ContractCall<Proof>): string[] {
  return transcriptsOf(call).flatMap((transcript) => [...transcript.effects.shieldedMints.keys()]);
}
