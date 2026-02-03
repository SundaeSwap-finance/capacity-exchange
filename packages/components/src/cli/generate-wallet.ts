import 'dotenv/config';
import { Command } from 'commander';
import { generateWallet } from '../cardano/generate-wallet';
import { runCli } from './utils';

const program = new Command();

program
  .name('generate-wallet')
  .description('Generate a new Cardano wallet or restore from mnemonic')
  .option('-o, --output <file>', 'Output file for seed hex', './seed.hex')
  .option('-m, --mnemonic <words>', 'Existing 24-word mnemonic (space-separated)')
  .parse();

const options = program.opts<{ output: string; mnemonic?: string }>();

runCli((config) =>
  generateWallet(config, {
    outputFile: options.output,
    mnemonic: options.mnemonic,
  }),
);
