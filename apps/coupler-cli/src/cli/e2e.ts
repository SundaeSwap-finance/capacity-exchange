import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { runE2e } from '../e2e/run.js';
import { SCENARIOS, requireScenario, scenarioNames } from '../e2e/scenarios.js';

/** A required env var, or throw with a hint. */
function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} (${hint})`);
  }
  return value;
}

function main() {
  program
    .name('coupler:e2e')
    .description('End-to-end TEST of bridgeless exchange: the LP funds the DUST and is paid on Cardano.')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument(
      '<scenario>',
      scenarioNames()
        .map((n) => `${n} (${SCENARIOS[n].description})`)
        .join('; ')
    )
    .parse();

  const couplerAddress = requireEnv('COUPLER_ADDRESS', 'an already-deployed coupler, see coupler:deploy');
  const counterAddress = requireEnv(
    'COUNTER_ADDRESS',
    'the pre-deployed counter, e.g. vars.E2E_COUNTER_ADDRESS_PREVIEW'
  );
  const snapshotDir = requireEnv(
    'CHAIN_SNAPSHOT_DIR',
    'chain snapshot for fast fresh-wallet sync, e.g. ../../.chain-snapshots'
  );
  const [networkId, scenario] = program.args;
  return withAppContextFromEnv(networkId, (ctx) =>
    runE2e(ctx, couplerAddress, counterAddress, snapshotDir, requireScenario(scenario))
  );
}

runCli(main, { pretty: true });
