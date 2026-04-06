import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { deploy as deployCounter } from './counter/lib/operations.js';
import { deploy as deployTokenMint } from './token-mint/lib/operations.js';
import { saveContractsConfig, ContractsConfig } from './lib/contracts-config.js';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

async function main(): Promise<ContractsConfig> {
  program
    .name('deploy-all')
    .description('Deploy all contracts and save config')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .option('--dry-run', 'Build, prove, and balance transactions without submitting')
    .parse();

  const [networkId] = program.args;
  const { dryRun } = program.opts<{ dryRun?: boolean }>();

  if (dryRun) {
    logger.info('*** DRY RUN MODE — transactions will not be submitted ***');
  }

  logger.info('=== Deploying Token Mint Contract ===');
  const tokenMintResult = await withAppContext(networkId, async (ctx) => {
    return deployTokenMint(ctx, undefined, dryRun);
  });
  logger.info(`Token mint deployed at ${tokenMintResult.contractAddress}`);

  logger.info('=== Deploying Counter Contract ===');
  const counterResult = await withAppContext(networkId, async (ctx) => {
    return deployCounter(ctx, dryRun);
  });
  logger.info(`Counter deployed at ${counterResult.contractAddress}`);

  const config: ContractsConfig = {
    networkId,
    tokenMint: {
      contractAddress: tokenMintResult.contractAddress,
      txHash: tokenMintResult.txHash,
      tokenColor: tokenMintResult.tokenColor,
      derivedTokenColor: tokenMintResult.derivedTokenColor,
      privateStateId: tokenMintResult.privateStateId,
      adminKeyHash: tokenMintResult.adminKeyHash,
    },
    counter: {
      contractAddress: counterResult.contractAddress,
      txHash: counterResult.txHash,
    },
  };

  if (!dryRun) {
    logger.info('=== Saving Contracts Config ===');
    saveContractsConfig(networkId, config);
    logger.info(`Config saved to .contracts.${networkId}.json`);
  } else {
    logger.info('=== Dry run complete — config not saved ===');
  }

  return config;
}

runCli(main, { pretty: true });
