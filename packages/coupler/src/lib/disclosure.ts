import {
  Transaction,
  rawTokenType,
  type Binding,
  type Proof,
  type ContractCall,
  type SignatureEnabled,
} from '@midnight-ntwrk/ledger-v8';
import { persistentHash, CompactTypeBytes, CompactTypeVector } from '@midnight-ntwrk/compact-runtime';
import {
  callsTo,
  cellWritesBySlot,
  entryPointOf,
  hexToBytes,
  mintedTokens,
  queryTxRaw,
  uint8ArrayToHex,
  type FinalizedTransaction,
} from '@sundaeswap/capacity-exchange-core';

/** The coupler's two ledger fields, in the order the contract declares them. */
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
  const reveals = callsTo(tx, couplerAddress).filter((call) => entryPointOf(call) === 'mintReveal');
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
