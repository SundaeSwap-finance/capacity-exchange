import { describe, it, expect } from 'vitest';
import { failedAssertions, type E2eReport } from '../../src/e2e/assertions.js';

/** A run where everything held, for a scenario submitting `couplings` of them. */
function passing(couplings: number, over: Partial<E2eReport> = {}): E2eReport {
  return {
    allLanded: true,
    allCouplingsRecovered: true,
    couplingsDistinct: true,
    lpPaid: true,
    userSpentNoDust: true,
    counter: { incrementedBy: couplings, expected: couplings },
    readFailures: {},
    ...over,
  };
}

describe('a run that did what it says reports nothing', () => {
  it('passes when every claim its scenario asked for holds', () => {
    expect(failedAssertions('bridgeless-exchange', passing(1))).toEqual([]);
    expect(failedAssertions('recover-overwritten', passing(2))).toEqual([]);
  });

  it('catches an unconfirmed submission', () => {
    expect(failedAssertions('bridgeless-exchange', passing(1, { allLanded: false }))).toContain('allLanded');
  });

  it('catches a read failure even when every boolean is true', () => {
    const r = passing(1, { readFailures: { tx1: 'noMintReveal' } });
    expect(failedAssertions('bridgeless-exchange', r)).toContain('noReadFailures');
  });

  it('catches the LP not paying, and the user paying', () => {
    const r = passing(1, { lpPaid: false, userSpentNoDust: false });
    expect(failedAssertions('bridgeless-exchange', r)).toEqual(expect.arrayContaining(['lpPaid', 'userSpentNoDust']));
  });

  it('names every failure, not just the first', () => {
    const r = passing(2, { allLanded: false, couplingsDistinct: false, lpPaid: false });
    expect(failedAssertions('recover-overwritten', r).length).toBeGreaterThan(2);
  });
});

// Fusing the scenarios meant one failure sank the whole run, and the basic exchange claim
// could only be reached through the two-coupling setup.
describe('a scenario is only held to what it set out to prove', () => {
  // Tying the disclosure to the commitment the LP funded is what makes the LP payable, so it is
  // meaningful at one coupling. Only distinctness needs a second one to compare against.
  it('fails a bridgeless exchange whose coupling was not recovered', () => {
    const r = passing(1, { allCouplingsRecovered: false });
    expect(failedAssertions('bridgeless-exchange', r)).toContain('allCouplingsRecovered');
  });

  it('does not fail a bridgeless exchange for distinctness, which needs a second coupling', () => {
    const r = passing(1, { couplingsDistinct: false });
    expect(failedAssertions('bridgeless-exchange', r)).toEqual([]);
  });

  it('does fail recover-overwritten for per-tx recovery, which is the whole point of it', () => {
    const r = passing(2, { allCouplingsRecovered: false });
    expect(failedAssertions('recover-overwritten', r)).toContain('allCouplingsRecovered');
  });
});

// The old claim was hardcoded to two increments, which only made sense for the fused run.
describe('the counter claim is proportional to what was submitted', () => {
  it('wants one increment for one coupling', () => {
    const r = passing(1, { counter: { incrementedBy: 2, expected: 1 } });
    expect(failedAssertions('bridgeless-exchange', r)).toContain('counterIncremented');
  });

  it('wants two for two, not at least two', () => {
    const r = passing(2, { counter: { incrementedBy: 3, expected: 2 } });
    expect(failedAssertions('recover-overwritten', r)).toContain('counterIncremented');
  });
});
