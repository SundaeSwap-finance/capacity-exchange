import { describe, it, expect } from 'vitest';
import { failedAssertions, type E2eReport } from '../../src/e2e/assertions.js';

/** A run where everything held. */
function passing(): E2eReport {
  return {
    allLanded: true,
    allCouplingsRecovered: true,
    couplingsDistinct: true,
    lpPaid: true,
    userSpentNoDust: true,
    bindingHolds: true,
    counter: { incrementedTwice: true },
    readFailures: {},
  };
}

describe('a run that did what it says reports nothing', () => {
  it('passes when every claim holds', () => {
    expect(failedAssertions(passing())).toEqual([]);
  });
});

// The case that motivated this: awaitInclusion returning undefined leaves allLanded false, and
// the run used to print that and exit zero.
describe('a claim that does not hold is named', () => {
  it('catches an unconfirmed submission', () => {
    expect(failedAssertions({ ...passing(), allLanded: false })).toEqual(['allLanded']);
  });

  it('catches a read failure even when every boolean is true', () => {
    const report = { ...passing(), readFailures: { txUnavailable: 1 } };
    expect(failedAssertions(report)).toEqual(['noReadFailures']);
  });

  it('catches the LP not paying, and the user paying', () => {
    const report = { ...passing(), lpPaid: false, userSpentNoDust: false };
    expect(failedAssertions(report)).toEqual(['lpPaid', 'userSpentNoDust']);
  });

  it('names every failure, not just the first', () => {
    const report = { ...passing(), allLanded: false, bindingHolds: false, counter: { incrementedTwice: false } };
    expect(failedAssertions(report)).toEqual(['allLanded', 'counter.incrementedTwice', 'bindingHolds']);
  });
});
