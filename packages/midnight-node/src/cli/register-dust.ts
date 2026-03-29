import { program } from 'commander';
import { runCli, withAppContext } from '../cli.js';
import { createLogger } from '../createLogger.js';
import { registerAllForDust, registerEachForDust, waitForDustBalance } from '../dust-registration.js';
import { splitAndRegister } from '../split-night.js';

const logger = createLogger(import.meta);

interface RegisterDustOutput {
  dustBalance: string;
  utxoCount: number;
}

function main(): Promise<RegisterDustOutput> {
  program
    .name('register-dust')
    .description(
      `Register NIGHT UTxOs for DUST generation. ` +
      `By default, it registers each UTxO individuallyto preserve the UTxO count. ` +
      `Use --merge to conslidate into a single UTxO, or --outputs N to split into N roughly equally-sized UTxOs.`
    )
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview, preprod)')
    .option('--merge', 'Consolidate all NIGHT into a single UTxO')
    .option('--outputs <count>', 'Split NIGHT into N roughly equally-sized UTxOs', parseInt)
    .parse();

  const [networkId] = program.args;
  const opts = program.opts<{ merge?: boolean; outputs?: number }>();

  if (opts.merge && opts.outputs) {
    throw new Error('--merge and --outputs are mutually exclusive');
  }
  if (opts.outputs !== undefined && (!Number.isFinite(opts.outputs) || opts.outputs < 2)) {
    throw new Error('--outputs must be an integer >= 2');
  }

  return withAppContext(networkId, async (ctx) => {
    const { walletFacade, keys } = ctx.walletContext;

    logger.info('Waiting for synced state...');
    const state = await walletFacade.waitForSyncedState();

    if (opts.outputs) {
      await splitAndRegister(walletFacade, keys, networkId, opts.outputs);
    } else if (opts.merge) {
      await registerAllForDust(state, walletFacade, keys);
    } else {
      await registerEachForDust(state, walletFacade, keys);
    }

    const updated = await waitForDustBalance(walletFacade);

    return {
      dustBalance: updated.dust.balance(new Date()).toString(),
      utxoCount: updated.unshielded.availableCoins.length,
    };
  });
}

runCli(main, { pretty: true });
