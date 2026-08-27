import {
  Transaction,
  rawTokenType,
  type SignatureEnabled,
  type Proof,
  type Binding,
  type Op,
  type AlignedValue,
  type ContractAction,
  type ContractCall,
  type Transcript,
} from '@midnight-ntwrk/ledger-v8';
import {
  persistentHash,
  CompactTypeBytes,
  CompactTypeVector,
  Bytes32Descriptor,
} from '@midnight-ntwrk/compact-runtime';
import { hexToBytes, uint8ArrayToHex, queryTxRaw } from '@sundaeswap/capacity-exchange-core';

type FinalizedTransaction = Transaction<SignatureEnabled, Proof, Binding>;
type CellValue = AlignedValue['value'];

export const S_SLOT = 0;
export const HSP_SLOT = 1;

const BYTES_32 = new CompactTypeBytes(32);
const VECTOR_2_BYTES_32 = new CompactTypeVector(2, BYTES_32);

/** Names a coupling by its two escrow commitments. Both coupler circuits derive the coin they
 *  mint from this same value, which is what lets a reader tie a reveal back to an escrow. */
export function couplingDomainSep(h: Uint8Array, hPrime: Uint8Array): Uint8Array {
  return persistentHash(VECTOR_2_BYTES_32, [h, hPrime]);
}

/** What one reveal made public: the secret, and the hash of the second secret. Read from an
 *  indexed transaction, which is not the same as the transaction having applied. */
export interface Disclosure {
  s: Uint8Array;
  hsp: Uint8Array;
  domainSep: Uint8Array;
  tokenColor: string;
}

/** Why a read produced nothing, named so a failure says which step gave up. */
export type DisclosureError =
  | { kind: 'noMintReveal' }
  | { kind: 'unexpectedSlots'; slots: number[] }
  | { kind: 'domainSepMismatch'; expected: string; minted: string[] }
  | { kind: 'txUnavailable'; detail: string }
  | { kind: 'decodeFailed'; detail: string };

/** The outcome of reading one transaction. A success carries every reveal that could be read,
 *  and a reason for each that could not, so one bad reveal does not hide the rest. */
export type DisclosureResult =
  | { ok: true; couplings: Disclosure[]; skipped: DisclosureError[] }
  | { ok: false; error: DisclosureError };

/** Picks out the coupling that settles a particular escrow, given the two commitments its
 *  owner holds. Returns nothing if this transaction does not settle it. */
export function findCoupling(couplings: Disclosure[], h: Uint8Array, hPrime: Uint8Array): Disclosure | undefined {
  const wanted = uint8ArrayToHex(couplingDomainSep(h, hPrime));
  return couplings.find((coupling) => uint8ArrayToHex(coupling.domainSep) === wanted);
}

/** A readable message from anything thrown. */
function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Reads the value out of an operation that pushes one onto the stack, or nothing if the
 *  operation does something else. */
function pushedCell(op: Op<AlignedValue>): CellValue | undefined {
  return pushedAligned(op)?.value;
}

/** The pushed cell with its alignment, which declares the field's real width. */
function pushedAligned(op: Op<AlignedValue>): AlignedValue | undefined {
  return typeof op === 'object' && 'push' in op && op.push.value.tag === 'cell' ? op.push.value.content : undefined;
}

/** Whether this operation writes a whole field. A deeper insert writes inside a map or an
 *  array, which is not what we are looking for. */
function writesWholeField(op: Op<AlignedValue>): boolean {
  return typeof op === 'object' && 'ins' in op && op.ins.n === 1;
}

/** Which contract field a write is aimed at. Fields are numbered, and the number arrives as a
 *  short key. A long key is an entry inside a map, so it has no field number. */
function slotIndex(key: CellValue): number | undefined {
  if (key.length !== 1 || key[0].length > 1) {
    return undefined;
  }
  return key[0][0] ?? 0;
}

/** Whether this is a call to our contract. Deploys and updates are excluded, since only calls
 *  carry the record of what ran. */
function isCouplerCall(action: ContractAction<Proof>, couplerAddress: string): action is ContractCall<Proof> {
  return 'guaranteedTranscript' in action && action.address === couplerAddress;
}

/** Which function of the contract was called. */
function entryPointOf(call: ContractCall<Proof>): string {
  return typeof call.entryPoint === 'string' ? call.entryPoint : new TextDecoder().decode(call.entryPoint);
}

/** The record of what a call did. There are two of them because the ledger splits execution
 *  into a part that always applies and a part that can be rolled back. */
function transcriptsOf(call: ContractCall<Proof>): Transcript<AlignedValue>[] {
  return [call.guaranteedTranscript, call.fallibleTranscript].filter((t) => t != null);
}

/** The written value, as the 32 bytes the circuit used. A field-aligned value is trimmed of
 *  trailing zeros, so only the alignment says how wide the field really is. */
function decodeBytes32(aligned: AlignedValue): Uint8Array | undefined {
  const { alignment } = aligned;
  const atom = alignment.length === 1 ? alignment[0] : undefined;
  if (atom?.tag !== 'atom' || atom.value.tag !== 'bytes' || atom.value.length !== 32) {
    return undefined;
  }
  return Bytes32Descriptor.fromValue([...aligned.value]);
}

export function cellWritesInProgram(program: Op<AlignedValue>[]): Map<number, Uint8Array> {
  const bySlot = new Map<number, Uint8Array>();
  for (let i = 2; i < program.length; i++) {
    if (!writesWholeField(program[i])) {
      continue;
    }
    const key = pushedCell(program[i - 2]);
    const written = pushedAligned(program[i - 1]);
    if (key == null || written == null) {
      continue;
    }
    const value = decodeBytes32(written);
    if (value == null) {
      continue;
    }
    const slot = slotIndex(key);
    if (slot != null) {
      bySlot.set(slot, value);
    }
  }
  return bySlot;
}

/** The cell writes of a call. Two programs, scanned apart so no write spans the join, and a
 *  slot written in both resolves to the one that always applies. */
export function mergeCellWrites(
  guaranteed: Op<AlignedValue>[] | undefined,
  fallible: Op<AlignedValue>[] | undefined
): Map<number, Uint8Array> {
  const writes = cellWritesInProgram(fallible ?? []);
  for (const [slot, value] of cellWritesInProgram(guaranteed ?? [])) {
    writes.set(slot, value);
  }
  return writes;
}

function cellWritesBySlot(call: ContractCall<Proof>): Map<number, Uint8Array> {
  return mergeCellWrites(call.guaranteedTranscript?.program, call.fallibleTranscript?.program);
}

/** The coins a call created. */
function mintedTokens(call: ContractCall<Proof>): string[] {
  return transcriptsOf(call).flatMap((transcript) => [...transcript.effects.shieldedMints.keys()]);
}

/** Reads every coupling revealed in a transaction. A transaction can settle more than one, so
 *  this returns them all and the caller picks out its own. Never throws. */
export function extractDisclosed(tx: FinalizedTransaction, couplerAddress: string): DisclosureResult {
  try {
    return readCouplings(tx, couplerAddress);
  } catch (err) {
    return { ok: false, error: { kind: 'decodeFailed', detail: errorDetail(err) } };
  }
}

/** Finds the reveals in a transaction and reads each one, keeping the ones that make sense and
 *  noting why the others did not. */
function readCouplings(tx: FinalizedTransaction, couplerAddress: string): DisclosureResult {
  const actions = [...(tx.intents?.values() ?? [])].flatMap((intent) => intent.actions);
  const calls = actions.filter((action): action is ContractCall<Proof> => isCouplerCall(action, couplerAddress));
  const reveals = calls.filter((call) => entryPointOf(call) === 'mintReveal');
  if (reveals.length === 0) {
    return { ok: false, error: { kind: 'noMintReveal' } };
  }

  const couplings: Disclosure[] = [];
  const skipped: DisclosureError[] = [];

  for (const reveal of reveals) {
    try {
      const coupling = readOneCoupling(reveal, couplerAddress);
      if ('kind' in coupling) {
        skipped.push(coupling);
      } else {
        couplings.push(coupling);
      }
    } catch (err) {
      skipped.push({ kind: 'decodeFailed', detail: errorDetail(err) });
    }
  }

  if (couplings.length === 0) {
    return { ok: false, error: skipped[0] ?? { kind: 'noMintReveal' } };
  }
  return { ok: true, couplings, skipped };
}

/** Reads a single reveal, checking that the values it disclosed really are the ones it used to
 *  create its coin. */
function readOneCoupling(reveal: ContractCall<Proof>, couplerAddress: string): Disclosure | DisclosureError {
  const cells = cellWritesBySlot(reveal);
  const s = cells.get(S_SLOT);
  const hsp = cells.get(HSP_SLOT);
  if (s == null || hsp == null) {
    return { kind: 'unexpectedSlots', slots: [...cells.keys()].sort((a, b) => a - b) };
  }

  const domainSep = couplingDomainSep(persistentHash(BYTES_32, s), hsp);
  const expected = uint8ArrayToHex(domainSep);
  const minted = mintedTokens(reveal);
  if (minted.length !== 1 || minted[0] !== expected) {
    return { kind: 'domainSepMismatch', expected, minted };
  }

  return { s, hsp, domainSep, tokenColor: rawTokenType(domainSep, couplerAddress) };
}

/** Fetches a transaction from the indexer and reads its couplings. Never throws. */
export async function readDisclosureAtTx(
  indexerUrl: string,
  couplerAddress: string,
  txId: string
): Promise<DisclosureResult> {
  let raw: string;
  try {
    raw = await queryTxRaw(indexerUrl, txId);
  } catch (err) {
    return { ok: false, error: { kind: 'txUnavailable', detail: errorDetail(err) } };
  }

  try {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      'signature',
      'proof',
      'binding',
      hexToBytes(raw)
    );
    return extractDisclosed(tx, couplerAddress);
  } catch (err) {
    return { ok: false, error: { kind: 'decodeFailed', detail: errorDetail(err) } };
  }
}
