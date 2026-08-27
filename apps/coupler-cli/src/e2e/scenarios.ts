/** A claim the report can be asked to support. */
export type ClaimName =
  | 'allLanded'
  | 'noReadFailures'
  | 'counterIncremented'
  | 'lpPaid'
  | 'userSpentNoDust'
  | 'allCouplingsRecovered'
  | 'couplingsDistinct';

export interface ScenarioSpec {
  /** How many couplings the scenario submits. */
  couplings: number;
  /** What a passing run of this scenario has shown. */
  claims: ClaimName[];
  description: string;
}

const BRIDGELESS_EXCHANGE: ClaimName[] = [
  'allLanded',
  'noReadFailures',
  'counterIncremented',
  'lpPaid',
  'userSpentNoDust',
  'allCouplingsRecovered',
];

export const SCENARIOS = {
  /** The basic claim: a user holding no dust gets a transaction through, funded by the LP. */
  'bridgeless-exchange': {
    couplings: 1,
    claims: BRIDGELESS_EXCHANGE,
    description: 'one coupling: the LP funds the DUST and the user spends none of their own',
  },
  /** The contract keeps only the latest coupling, so a second one overwrites the first's cells.
   *  Both ride in one transaction, so the earlier secret survives nowhere else and recovering it
   *  from that transaction is what the per-tx read exists for. */
  'recover-overwritten': {
    couplings: 2,
    claims: [...BRIDGELESS_EXCHANGE, 'couplingsDistinct'],
    description: 'two couplings in one tx: the overwritten one stays recoverable from that tx',
  },
} as const satisfies Record<string, ScenarioSpec>;

export type Scenario = keyof typeof SCENARIOS;

export function scenarioNames(): Scenario[] {
  return Object.keys(SCENARIOS) as Scenario[];
}

export function requireScenario(name: string): Scenario {
  if (!(name in SCENARIOS)) {
    throw new Error(`unknown scenario '${name}', expected one of ${scenarioNames().join(', ')}`);
  }
  return name as Scenario;
}
