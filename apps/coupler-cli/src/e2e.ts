import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { runE2e } from './e2e-run.js';

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
    .description('End-to-end TEST of coupling with purchased capacity: the LP pays the DUST, the user pays nothing.')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .parse();

  const counterAddress = requireEnv(
    'COUNTER_ADDRESS',
    'the pre-deployed counter, e.g. vars.E2E_COUNTER_ADDRESS_PREVIEW'
  );
  const snapshotDir = requireEnv(
    'CHAIN_SNAPSHOT_DIR',
    'chain snapshot for fast fresh-wallet sync, e.g. ../../.chain-snapshots'
  );
  const [networkId] = program.args;
  return withAppContextFromEnv(networkId, (ctx) => runE2e(ctx, counterAddress, snapshotDir));
}

runCli(main, { pretty: true });
