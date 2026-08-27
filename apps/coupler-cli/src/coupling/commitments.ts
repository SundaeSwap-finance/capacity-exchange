import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import {
  couplingDomainSep,
  findCoupling,
  type Disclosure,
  type DisclosureResult,
} from '@sundaeswap/capacity-exchange-coupler/operations';

/** The escrow commitments of one coupling, as the LP knows them. */
export interface CouplingCommitment {
  h: Uint8Array;
  hPrime: Uint8Array;
}

/** What one tx is expected to disclose. The mirror of DisclosureRead. */
export interface CouplingExpectation {
  txId: string;
  couplings: CouplingCommitment[];
}

/** One disclosure read, keyed by the tx it came from. Separate submission yields one of these
 *  per coupling. Merged submission yields a single read carrying every coupling. */
export interface DisclosureRead {
  txId: string;
  result: DisclosureResult;
}

export interface CouplingOutcome {
  /** Every coupling recovered across all reads, in read order. */
  recovered: Disclosure[];
  /** Each expected commitment resolved to its own coupling, by domain separator. undefined
   *  means the read did not carry that coupling at all. */
  bySpec: (Disclosure | undefined)[];
  /** Every expected coupling was found, and each resolved to a distinct disclosure. */
  allFound: boolean;
  /** The recovered couplings are pairwise distinct in both disclosed values. Compared as hex:
   *  Uint8Array inequality is reference identity and would hold for any two reads. */
  allDistinct: boolean;
  /** Reads that failed, as txId to error kind. */
  failures: Record<string, string>;
}

/** Resolve what a coupling run actually disclosed.
 *
 *  Kept free of chain access so a run's outcome can be exercised offline against recorded
 *  transactions. The run itself only supplies the reads. A read may carry several couplings,
 *  so this resolves each expectation by commitment rather than by position. */
export function couplingOutcome(reads: DisclosureRead[], expected: CouplingExpectation[]): CouplingOutcome {
  const failures: Record<string, string> = {};
  const byTxId = new Map<string, Disclosure[]>();

  for (const read of reads) {
    if (read.result.ok) {
      byTxId.set(read.txId, [...(byTxId.get(read.txId) ?? []), ...read.result.couplings]);
    } else {
      failures[read.txId] = read.result.error.kind;
    }
  }
  const recovered = [...byTxId.values()].flat();

  const distinctBy = (items: Disclosure[], pick: (c: Disclosure) => Uint8Array) =>
    new Set(items.map((c) => uint8ArrayToHex(pick(c)))).size === items.length;

  const bySpec = expected.flatMap((e) => e.couplings.map((c) => findCoupling(byTxId.get(e.txId) ?? [], c.h, c.hPrime)));
  const found = bySpec.filter((c) => c != null);
  const allFound = found.length === bySpec.length && distinctBy(found, (c) => c.domainSep);
  const allDistinct = distinctBy(recovered, (c) => c.s) && distinctBy(recovered, (c) => c.hsp);

  return { recovered, bySpec, allFound, allDistinct, failures };
}

/** The domain separator the LP derives from the escrow commitments it funded. Re-exported so a
 *  caller can key its own bookkeeping by the same value the disclosure carries. */
export { couplingDomainSep };
