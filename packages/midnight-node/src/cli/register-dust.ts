import { program } from 'commander';
import { runCli, withAppContext } from '../cli.js';
import { createLogger } from '../createLogger.js';
import { registerAllForDust, waitForDustBalance } from '../dust-registration.js';

const logger = createLogger(import.meta);

interface RegisterDustOutput {
  dustBalance: string;
}

function main(): Promise<RegisterDustOutput> {
  program
    .name('register-dust')
    .description('Register all unshielded NIGHT UTXOs for dust generation')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview, preprod)')
    .parse();

  const [networkId] = program.args;

  return withAppContext(networkId, async (ctx) => {
    const { walletFacade, keys } = ctx.walletContext;

    logger.info('Waiting for synced state...');
    const state = await walletFacade.waitForSyncedState();

    await registerAllForDust(state, walletFacade, keys);
    const updated = await waitForDustBalance(walletFacade);

    return {
      dustBalance: updated.dust.balance(new Date()).toString(),
    };
  });
}

runCli(main, { pretty: true });
