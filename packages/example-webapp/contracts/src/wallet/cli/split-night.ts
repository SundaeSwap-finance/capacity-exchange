import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { splitAndRegister, type SplitNightOutput } from '../lib/split-night.js';

function main(): Promise<SplitNightOutput> {
  program
    .name('split-night')
    .description('Splits unshielded NIGHT balance into N equally sized UTxOs (handles dust de/re-registration)')
    .argument('<networkId>', 'Network ID (e.g., preview, preprod)')
    .argument('<count>', 'Number of UTxOs to create')
    .parse();

  const [networkId, countStr] = program.args;
  const count = parseInt(countStr, 10);
  if (!Number.isFinite(count) || count < 2) {
    throw new Error('count must be an integer >= 2');
  }

  return withAppContext(networkId, (ctx) => {
    const { walletFacade, keys } = ctx.walletContext;
    return splitAndRegister(walletFacade, keys, networkId, count);
  });
}

runCli(main, { pretty: true });
