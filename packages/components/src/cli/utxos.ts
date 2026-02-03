import 'dotenv/config';
import { Command } from 'commander';
import { getUtxos } from '../cardano/utxos';
import { runCli } from './utils';

const program = new Command();

program
  .name('utxos')
  .description('List all UTxOs at an address')
  .requiredOption('-a, --address <address>', 'Bech32 address to query')
  .parse();

const options = program.opts<{ address: string }>();

runCli((config) => getUtxos(config, { address: options.address }));
