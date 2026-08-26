import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import type { Disclosure } from '@sundaeswap/capacity-exchange-coupler/operations';

/** One saved coupling, in the shape the offline decode tests read. */
export interface FixtureCoupling {
  label: string;
  couplerAddress: string;
  txId: string;
  raw: string;
  expectedS: string;
  expectedHsp: string;
}

export interface DisclosureFixture {
  couplings: FixtureCoupling[];
}

/** A submitted coupling and what it turned out to disclose. */
export interface CapturedCoupling {
  txId: string;
  raw: string;
  disclosure: Disclosure;
}

/** Name every unlabelled coupling, skipping any number already taken. */
function labelled(couplings: FixtureCoupling[]): FixtureCoupling[] {
  const used = new Set(couplings.map((c) => c.label).filter((l) => l !== ''));
  let n = 0;
  return couplings.map((c) => {
    if (c.label !== '') {
      return c;
    }
    while (used.has(`coupling${++n}`)) {
      // taken by an entry already in the file
    }
    used.add(`coupling${n}`);
    return { ...c, label: `coupling${n}` };
  });
}

export function buildFixture(couplerAddress: string, captured: CapturedCoupling[]): DisclosureFixture {
  return {
    couplings: labelled(
      captured.map((c) => ({
        label: '',
        couplerAddress,
        txId: c.txId,
        raw: c.raw,
        expectedS: uint8ArrayToHex(c.disclosure.s),
        expectedHsp: uint8ArrayToHex(c.disclosure.hsp),
      }))
    ),
  };
}

/** Add a later run's couplings to an earlier fixture. Each coupling names the coupler it settled
 *  against, so a file may hold runs from more than one deployment. Labels already in the file are
 *  what tests select by, so they survive and only the incoming couplings are named. */
export function mergeFixture(into: DisclosureFixture, next: DisclosureFixture): DisclosureFixture {
  return {
    couplings: labelled([...into.couplings, ...next.couplings.map((c) => ({ ...c, label: '' }))]),
  };
}
