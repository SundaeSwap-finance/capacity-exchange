import 'dotenv/config';
import { Command } from 'commander';
import { deposit } from '../cardano/deposit';
import { createBlaze } from '../cardano/wallet';
import { runCli } from './utils';

const program = new Command();

program
  .name('deposit')
  .description('Deposit ADA to a Midnight shielded address')
  .requiredOption('-m, --midnight-address <address>', 'Recipient Midnight shielded address')
  .requiredOption('-l, --lovelace <amount>', 'Amount in lovelace (1 ADA = 1,000,000 lovelace)')
  .parse();

const options = program.opts<{ midnightAddress: string; lovelace: string }>();

runCli(async (config) => {
  const blaze = await createBlaze(config);
  return deposit(blaze, {
    depositAddress: config.depositAddress,
    shieldedMidnightAddress: options.midnightAddress,
    lovelace: BigInt(options.lovelace),
  });
});
