import { describe, it, expect } from 'vitest';
import { e2eReport, type E2eFacts } from '../../src/e2e/report.js';

const facts = (over: Partial<E2eFacts> = {}): E2eFacts => ({
  couplerAddress: 'coupler',
  counterAddress: 'counter',
  run: {
    txIds: ['tx1', 'tx2'],
    finals: [{ status: 'SucceedEntirely' }, { status: 'SucceedEntirely' }],
    reads: [],
    outcome: { recovered: [], bySpec: [], allFound: true, allDistinct: true, failures: {} },
  } as unknown as E2eFacts['run'],
  roundBefore: 10n,
  roundAfter: 12n,
  userDustBefore: 5n,
  userDustAfter: 5n,
  lpDustSpent: ['a#1'],
  lpPaid: true,
  binding: { bindingHolds: true, wrongHPrimeError: 'mismatch' },
  ...over,
});

describe('the e2e report states what the run observed', () => {
  it('holds when every claim does', () => {
    const r = e2eReport(facts());
    expect(r.allLanded).toBe(true);
    expect(r.incrementedTwice ?? r.counter.incrementedTwice).toBe(true);
    expect(r.userSpentNoDust).toBe(true);
  });

  it('counts exactly two increments, not at least two', () => {
    expect(e2eReport(facts({ roundAfter: 13n })).counter.incrementedTwice).toBe(false);
    expect(e2eReport(facts({ roundAfter: 11n })).counter.incrementedTwice).toBe(false);
  });

  it('sees the user paying anything at all', () => {
    expect(e2eReport(facts({ userDustAfter: 4n })).userSpentNoDust).toBe(false);
  });

  it('does not call a run landed when a tx did not succeed', () => {
    const run = { ...facts().run, finals: [{ status: 'SucceedEntirely' }, undefined] } as E2eFacts['run'];
    expect(e2eReport(facts({ run })).allLanded).toBe(false);
  });

  it('does not call a run landed when nothing was submitted', () => {
    const run = { ...facts().run, finals: [] } as unknown as E2eFacts['run'];
    expect(e2eReport(facts({ run })).allLanded).toBe(false);
  });
});
