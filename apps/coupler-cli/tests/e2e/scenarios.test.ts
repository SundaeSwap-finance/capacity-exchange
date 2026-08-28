import { describe, it, expect } from 'vitest';
import { SCENARIOS, scenarioNames, requireScenario } from '../../src/e2e/scenarios.js';

describe('each scenario asks for only what it proves', () => {
  it('bridgeless exchange needs one coupling and never mentions recovery claims', () => {
    const s = SCENARIOS['bridgeless-exchange'];
    expect(s.couplings).toBe(1);
    expect(s.claims).toContain('lpPaid');
    expect(s.claims).toContain('userSpentNoDust');
    expect(s.claims).not.toContain('couplingsDistinct');
  });

  // The contract keeps only the last coupling, so a second one is what makes the per-tx read
  // mean anything. One coupling would pass whether the reader looked at live state or the tx.
  it('recover-overwritten needs two couplings and claims per-tx recovery', () => {
    const s = SCENARIOS['recover-overwritten'];
    expect(s.couplings).toBe(2);
    expect(s.claims).toContain('allCouplingsRecovered');
    expect(s.claims).toContain('couplingsDistinct');
  });

  it('rejects an unknown scenario by naming the ones that exist', () => {
    expect(() => requireScenario('nope')).toThrow(/bridgeless-exchange/);
    expect(scenarioNames()).toEqual(['bridgeless-exchange', 'recover-overwritten']);
  });
});
