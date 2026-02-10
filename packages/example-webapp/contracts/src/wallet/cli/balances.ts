import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';

interface BalancesOutput {
  dustBalance: string;
  dustAddress: string;
  shieldedBalances: Record<string, string>;
  shieldedAddress: string;
  unshieldedAddress: string;
  unshieldedBalances: Record<string, string>;
}

function main(): Promise<BalancesOutput> {
  program
    .name('balances')
    .description('Syncs wallet and prints balances')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .parse();

  const [networkId] = program.args;

  return withAppContext(networkId, async (ctx) => {
    const { walletFacade } = ctx.walletContext;

    const [dustState, shieldedState, unshieldedState] = await Promise.all([
      walletFacade.dust.waitForSyncedState(),
      walletFacade.shielded.waitForSyncedState(),
      walletFacade.unshielded.waitForSyncedState(),
    ]);

    const dustBalance = dustState.walletBalance(new Date());

    const shieldedBalances: Record<string, string> = {};
    for (const [token, amount] of Object.entries(shieldedState.balances)) {
      shieldedBalances[token] = amount.toString();
    }

    const unshieldedBalances: Record<string, string> = {};
    for (const [token, amount] of Object.entries(unshieldedState.balances)) {
      unshieldedBalances[token] = amount.toString();
    }

    return {
      dustBalance: dustBalance.toString(),
      dustAddress: dustState.dustAddress,
      shieldedBalances,
      shieldedAddress: String(shieldedState.address),
      unshieldedAddress: String(unshieldedState.address),
      unshieldedBalances,
    };
  });
}

runCli(main, { pretty: true });
