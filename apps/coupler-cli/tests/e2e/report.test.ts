import { describe, it, expect } from 'vitest';
import { e2eReport, type E2eFacts } from '../../src/e2e/report.js';

const facts = (over: Partial<E2eFacts> = {}): E2eFacts => ({
  scenario: 'recover-overwritten',
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
  ...over,
});

describe('the e2e report states what the run observed', () => {
  it('holds when every claim does', () => {
    const r = e2eReport(facts());
    expect(r.allLanded).toBe(true);
    expect(r.userSpentNoDust).toBe(true);
  });

  // The report states what happened and what the scenario asked for, and leaves the verdict
  // to the claims, so the same numbers read differently under a one-coupling scenario.
  it('reports the increment count against what the scenario submits', () => {
    expect(e2eReport(facts()).counter).toMatchObject({ incrementedBy: 2, expected: 2 });
    expect(e2eReport(facts({ scenario: 'bridgeless-exchange' })).counter).toMatchObject({ expected: 1 });
  });

  it('reports an increment that did not happen as the number it was', () => {
    expect(e2eReport(facts({ roundAfter: 13n })).counter.incrementedBy).toBe(3);
    expect(e2eReport(facts({ roundAfter: 10n })).counter.incrementedBy).toBe(0);
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
