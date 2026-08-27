import type { CouplingRunResult } from '../coupling/submit.js';
import type { Scenario } from './scenarios.js';
import { SCENARIOS } from './scenarios.js';

export interface E2eFacts {
  scenario: Scenario;
  couplerAddress: string;
  counterAddress: string;
  run: CouplingRunResult;
  roundBefore: bigint;
  roundAfter: bigint;
  userDustBefore: bigint;
  userDustAfter: bigint;
  lpDustSpent: string[];
  lpPaid: boolean;
}

/** The report, as a function of what the run observed. Pure, so the claims it states can be
 *  exercised without a chain. */
export function e2eReport(f: E2eFacts) {
  return {
    scenario: f.scenario,
    couplerAddress: f.couplerAddress,
    txIds: f.run.txIds,
    allLanded: f.run.finals.length > 0 && f.run.finals.every((fin) => fin?.status === 'SucceedEntirely'),
    allCouplingsRecovered: f.run.outcome.allFound,
    couplingsDistinct: f.run.outcome.allDistinct,
    disclosures: f.run.reads.map((read) => (read.result.ok ? read.result.couplings : read.result.error)),
    readFailures: f.run.outcome.failures,
    counter: {
      address: f.counterAddress,
      roundBefore: String(f.roundBefore),
      roundAfter: String(f.roundAfter),
      incrementedBy: Number(f.roundAfter - f.roundBefore),
      expected: SCENARIOS[f.scenario].couplings,
    },
    lpDustSpent: f.lpDustSpent,
    lpPaid: f.lpPaid,
    userDustBefore: String(f.userDustBefore),
    userDustAfter: String(f.userDustAfter),
    userSpentNoDust: f.userDustAfter === f.userDustBefore,
  };
}
