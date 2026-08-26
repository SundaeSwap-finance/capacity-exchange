import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { runCapture } from '../capture/chain.js';

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
    .name('coupler:capture')
    .description('Couple once against a real chain and record what it disclosed, for the offline decode tests.')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .requiredOption('--out <path>', 'fixture file to append to, created when absent')
    .parse();

  const couplerAddress = requireEnv('COUPLER_ADDRESS', 'an already-deployed coupler, see coupler:deploy');
  const counterAddress = requireEnv('COUNTER_ADDRESS', 'the pre-deployed counter the coupling pays for');
  const snapshotDir = requireEnv('CHAIN_SNAPSHOT_DIR', 'chain snapshot for fast fresh-wallet sync');
  const [networkId] = program.args;
  const { out } = program.opts();
  return withAppContextFromEnv(networkId, (ctx) => runCapture(ctx, couplerAddress, counterAddress, snapshotDir, out));
}

runCli(main, { pretty: true });
