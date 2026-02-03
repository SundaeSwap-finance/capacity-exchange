import 'dotenv/config';
import { Command } from 'commander';
import { send } from '../cardano/send';
import { runCli } from './utils';

const program = new Command();

program
  .name('send')
  .description('Send ADA to a Cardano address')
  .requiredOption('-a, --address <address>', 'Recipient Bech32 address')
  .requiredOption('-l, --lovelace <amount>', 'Amount in lovelace (1 ADA = 1,000,000 lovelace)')
  .parse();

const options = program.opts<{ address: string; lovelace: string }>();

runCli((config) =>
  send(config, {
    recipientAddress: options.address,
    lovelace: BigInt(options.lovelace),
  }),
);
