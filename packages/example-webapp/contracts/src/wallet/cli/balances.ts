import { program } from 'commander';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { runCli, withAppContext } from '@capacity-exchange/components/midnight';
import { createLogger } from '@capacity-exchange/core/node';
import { registerForDust } from '../lib/dust-registration.js';

function bigintBalances(record: Record<string, bigint>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [type, amount] of Object.entries(record)) {
    out[type] = amount.toString();
  }
  return out;
}

const logger = createLogger(import.meta);

interface BalancesOutput {
  addresses: {
    dust: string;
    shielded: string;
    unshielded: string;
  };
  dust: string;
  shielded: Record<string, string>;
  unshielded: Record<string, string>;
  dustRegistered: boolean;
}

function main(): Promise<BalancesOutput> {
  program
    .name('balances')
    .description('Syncs the wallet and prints all balances. Use --register-dust to register for dust generation.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview, preprod)')
    .option('--register-dust', 'Register unshielded NIGHT UTXOs for dust generation')
    .parse();

  const [networkId] = program.args;
  const opts = program.opts<{ registerDust?: boolean }>();

  return withAppContext(networkId, async (ctx) => {
    const { walletFacade, keys } = ctx.walletContext;

    logger.info('Waiting for synced state...');
    let state = await walletFacade.waitForSyncedState();
    const dustRegistered = state.dust.availableCoins.length > 0;
    logger.info(`Dust registered: ${dustRegistered}`);

    if (opts.registerDust && !dustRegistered) {
      logger.info('Registering for dust...');
      state = await registerForDust(state, walletFacade, keys);
    }

    const result = {
      addresses: {
        dust: state.dust.dustAddress,
        shielded: MidnightBech32m.encode(networkId, state.shielded.address).asString(),
        unshielded: MidnightBech32m.encode(networkId, state.unshielded.address).asString(),
      },
      dust: state.dust.walletBalance(new Date()).toString(),
      shielded: bigintBalances(state.shielded.balances),
      unshielded: bigintBalances(state.unshielded.balances),
      dustRegistered: state.dust.availableCoins.length > 0,
    };
    return result;
  });
}

runCli(main, { pretty: true });
