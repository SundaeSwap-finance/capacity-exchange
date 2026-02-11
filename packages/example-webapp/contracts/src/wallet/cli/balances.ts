import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { createLogger } from '../../lib/logger.js';
import { bigintBalances } from '../lib/format.js';
import { registerForDust } from '../lib/dust-registration.js';

const logger = createLogger(import.meta);

interface BalancesOutput {
  dust: string;
  shielded: Record<string, string>;
  unshielded: Record<string, string>;
  dustRegistered: boolean;
}

function main(): Promise<BalancesOutput> {
  program
    .name('wallet:balances')
    .description('Syncs the wallet and prints all balances. Use --register-dust to register for dust generation.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview, preprod)')
    .option('--register-dust', 'Register unshielded NIGHT UTXOs for dust generation')
    .parse();

  const [networkId] = program.args;
  const opts = program.opts<{ registerDust?: boolean }>();

  return withAppContext(networkId, async (ctx) => {
    const { walletFacade, keys } = ctx.walletContext;

    logger.log('Waiting for synced state...');
    let state = await walletFacade.waitForSyncedState();
    const dustRegistered = state.dust.availableCoins.length > 0;
    logger.log(`Dust registered: ${dustRegistered}`);

    if (opts.registerDust && !dustRegistered) {
      logger.log('Registering for dust...');
      state = await registerForDust(state, walletFacade, keys);
    }

    const result = {
      dust: state.dust.walletBalance(new Date()).toString(),
      shielded: bigintBalances(state.shielded.balances),
      unshielded: bigintBalances(state.unshielded.balances),
      dustRegistered: state.dust.availableCoins.length > 0,
    };
    return result;
  });
}

runCli(main, { pretty: true });
