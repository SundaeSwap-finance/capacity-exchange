import 'dotenv/config';
import { Command } from 'commander';
import { generateWallet } from '../cardano/wallet/generate';
import { restoreWallet } from '../cardano/wallet/restore';
import { createBlazeFromMnemonicFile, createProvider } from '../cardano/wallet/provider';
import { getUtxos } from '../cardano/utxos';
import { deposit } from '../cardano/deposit';
import { getNetworkConfig } from '../cardano/config';
import { runCli } from './utils';

const program = new Command();

program.name('wallet').description('Cardano wallet operations');

program
  .command('generate')
  .description('Generate a new Cardano wallet')
  .requiredOption('-o, --output <file>', 'Output file for seed hex')
  .requiredOption('-w, --mnemonic-out <file>', 'Output file for mnemonic')
  .action(async (options: { output: string; mnemonicOut: string }) => {
    await runCli(async () => {
      const provider = createProvider(getNetworkConfig());
      return generateWallet(provider, {
        seedFile: options.output,
        mnemonicFile: options.mnemonicOut,
      });
    });
  });

program
  .command('restore')
  .description('Restore a Cardano wallet from a mnemonic file')
  .requiredOption('-o, --output <file>', 'Output file for seed hex')
  .requiredOption('-r, --mnemonic-in <file>', 'Input file with existing mnemonic')
  .action(async (options: { output: string; mnemonicIn: string }) => {
    await runCli(async () => {
      const provider = createProvider(getNetworkConfig());
      return restoreWallet(provider, {
        seedFile: options.output,
        mnemonicIn: options.mnemonicIn,
      });
    });
  });

program
  .command('utxos')
  .description('List all UTxOs at an address')
  .requiredOption('-a, --address <address>', 'Bech32 address to query')
  .action(async (options: { address: string }) => {
    await runCli(async () => {
      const provider = createProvider(getNetworkConfig());
      return getUtxos(provider, { address: options.address });
    });
  });

program
  .command('deposit-midnight')
  .description('Deposit ADA to a Midnight shielded address')
  .requiredOption('-k, --mnemonic <file>', 'Path to mnemonic file')
  .requiredOption('-d, --deposit-address <address>', 'Cardano deposit address')
  .requiredOption('-m, --midnight-address <address>', 'Recipient Midnight shielded address')
  .requiredOption('-l, --lovelace <amount>', 'Amount in lovelace (1 ADA = 1,000,000 lovelace)')
  .action(async (options: { mnemonic: string; depositAddress: string; midnightAddress: string; lovelace: string }) => {
    await runCli(async () => {
      const provider = createProvider(getNetworkConfig());
      const blaze = await createBlazeFromMnemonicFile(provider, options.mnemonic);
      return deposit(blaze, {
        depositAddress: options.depositAddress,
        shieldedMidnightAddress: options.midnightAddress,
        lovelace: BigInt(options.lovelace),
      });
    });
  });

program.parseAsync();
