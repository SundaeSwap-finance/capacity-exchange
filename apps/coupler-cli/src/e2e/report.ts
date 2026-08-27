import type { CouplingRunResult } from '../coupling/submit.js';

export interface E2eFacts {
  couplerAddress: string;
  counterAddress: string;
  run: CouplingRunResult;
  roundBefore: bigint;
  roundAfter: bigint;
  userDustBefore: bigint;
  userDustAfter: bigint;
  lpDustSpent: string[];
  lpPaid: boolean;
  binding: { bindingHolds: boolean; wrongHPrimeError: string };
}

/** The report, as a function of what the run observed. Pure, so the claims it states can be
 *  exercised without a chain. */
export function e2eReport(f: E2eFacts) {
  return {
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
      incrementedTwice: f.roundAfter === f.roundBefore + 2n,
    },
    lpDustSpent: f.lpDustSpent,
    lpPaid: f.lpPaid,
    userDustBefore: String(f.userDustBefore),
    userDustAfter: String(f.userDustAfter),
    userSpentNoDust: f.userDustAfter === f.userDustBefore,
    bindingHolds: f.binding.bindingHolds,
    wrongHPrimeError: f.binding.wrongHPrimeError,
  };
}
