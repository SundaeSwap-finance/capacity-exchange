import { specksToNight, extractBalances } from '@capacity-exchange/midnight-core';
import type { CliConfig } from '../lib/config';
import { withCliContext, createConnectedAPIFromContext } from '../lib/context';
import { createSpinner, printNote, printJson, isJsonMode } from '../lib/output';

export interface BalancesResult {
  dust: string;
  nightShielded: string;
  nightUnshielded: string;
  tokens: Array<{ color: string; amount: string }>;
}

export async function runBalances(config: CliConfig, opts: { mnemonic?: string }): Promise<void> {
  const spin = createSpinner();
  spin.start('Syncing wallet...');

  const result = await withCliContext(config, opts.mnemonic, async (ctx) => {
    spin.stop('Wallet synced');

    const connectedAPI = createConnectedAPIFromContext(ctx, config);

    spin.start('Fetching balances...');
    const [dustBalance, shieldedBalances, unshieldedBalances] = await Promise.all([
      connectedAPI.getDustBalance(),
      connectedAPI.getShieldedBalances(),
      connectedAPI.getUnshieldedBalances(),
    ]);
    spin.stop('Balances fetched');

    return { dustBalance, shieldedBalances, unshieldedBalances };
  });

  const { dustBalance, shieldedBalances, unshieldedBalances } = result;

  const shielded = extractBalances(shieldedBalances);
  const unshielded = extractBalances(unshieldedBalances);

  const balancesResult: BalancesResult = {
    dust: dustBalance.balance.toString(),
    nightShielded: specksToNight(shielded.night),
    nightUnshielded: specksToNight(unshielded.night),
    tokens: shielded.tokens.map((t) => ({ color: t.color, amount: t.amount.toString() })),
  };

  if (isJsonMode()) {
    printJson(balancesResult);
  } else {
    const lines = [
      `DUST:               ${BigInt(dustBalance.balance).toLocaleString()} specks`,
      `NIGHT (shielded):   ${balancesResult.nightShielded}`,
      `NIGHT (unshielded): ${balancesResult.nightUnshielded}`,
    ];

    for (const token of balancesResult.tokens) {
      const shortColor =
        token.color.length > 16 ? `${token.color.slice(0, 8)}...${token.color.slice(-8)}` : token.color;
      lines.push(`Token ${shortColor}:  ${token.amount}`);
    }

    printNote(lines.join('\n'), 'Wallet Balances');
  }
}
