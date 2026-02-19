import { program } from 'commander';
import { runCli, withAppContext } from './lib/cli.js';
import { deploy as deployCounter } from './counter/lib/operations.js';
import { deploy as deployTokenMint } from './token-mint/lib/operations.js';
import { saveContractsConfig, ContractsConfig } from './lib/contracts-config.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);

async function main(): Promise<ContractsConfig> {
  program
    .name('deploy-all')
    .description('Deploy all contracts and save config')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .parse();

  const [networkId] = program.args;

  logger.info('=== Deploying Token Mint Contract ===');
  const tokenMintResult = await withAppContext(networkId, async (ctx) => {
    return deployTokenMint(ctx);
  });
  logger.info(`Token mint deployed at ${tokenMintResult.contractAddress}`);

  logger.info('=== Deploying Counter Contract ===');
  const counterResult = await withAppContext(networkId, async (ctx) => {
    return deployCounter(ctx);
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
    },
    counter: {
      contractAddress: counterResult.contractAddress,
      txHash: counterResult.txHash,
    },
  };

  logger.info('=== Saving Contracts Config ===');
  saveContractsConfig(networkId, config);
  logger.info(`Config saved to .contracts.${networkId}.json`);

  return config;
}

runCli(main, { pretty: true });
