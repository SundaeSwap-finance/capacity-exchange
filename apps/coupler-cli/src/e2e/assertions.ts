import type { ClaimName, Scenario } from './scenarios.js';
import { SCENARIOS } from './scenarios.js';

/** The report a run produces. Only the fields a claim reads are named here. */
export interface E2eReport {
  allLanded: boolean;
  allCouplingsRecovered: boolean;
  couplingsDistinct: boolean;
  lpPaid: boolean;
  userSpentNoDust: boolean;
  counter: { incrementedBy: number; expected: number };
  readFailures: Record<string, unknown>;
}

const HOLDS: Record<ClaimName, (r: E2eReport) => boolean> = {
  allLanded: (r) => r.allLanded,
  noReadFailures: (r) => Object.keys(r.readFailures).length === 0,
  counterIncremented: (r) => r.counter.incrementedBy === r.counter.expected,
  lpPaid: (r) => r.lpPaid,
  userSpentNoDust: (r) => r.userSpentNoDust,
  allCouplingsRecovered: (r) => r.allCouplingsRecovered,
  couplingsDistinct: (r) => r.couplingsDistinct,
};

/** The claims this scenario asked for that the report does not support. Empty means it passed. */
export function failedAssertions(scenario: Scenario, report: E2eReport): string[] {
  return SCENARIOS[scenario].claims.filter((name) => !HOLDS[name](report));
}
