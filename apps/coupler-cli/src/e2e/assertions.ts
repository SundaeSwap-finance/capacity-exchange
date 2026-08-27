/** The report a coupling run produces. Only the fields that have to be true are named here. */
export interface E2eReport {
  allLanded: boolean;
  allCouplingsRecovered: boolean;
  couplingsDistinct: boolean;
  lpPaid: boolean;
  userSpentNoDust: boolean;
  bindingHolds: boolean;
  counter: { incrementedTwice: boolean };
  readFailures: Record<string, unknown>;
}

/** Every claim the run makes about itself. A run that satisfies all of these did what it says. */
const CLAIMS: { name: string; holds: (r: E2eReport) => boolean }[] = [
  { name: 'allLanded', holds: (r) => r.allLanded },
  { name: 'allCouplingsRecovered', holds: (r) => r.allCouplingsRecovered },
  { name: 'couplingsDistinct', holds: (r) => r.couplingsDistinct },
  { name: 'counter.incrementedTwice', holds: (r) => r.counter.incrementedTwice },
  { name: 'lpPaid', holds: (r) => r.lpPaid },
  { name: 'userSpentNoDust', holds: (r) => r.userSpentNoDust },
  { name: 'bindingHolds', holds: (r) => r.bindingHolds },
  { name: 'noReadFailures', holds: (r) => Object.keys(r.readFailures).length === 0 },
];

/** The claims this report does not support, in the order above. Empty means the run passed. */
export function failedAssertions(report: E2eReport): string[] {
  return CLAIMS.filter((claim) => !claim.holds(report)).map((claim) => claim.name);
}
