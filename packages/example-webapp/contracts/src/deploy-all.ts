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

  logger.log('=== Deploying Token Mint Contract ===');
  const tokenMintResult = await withAppContext(networkId, './token-mint/out', async (ctx) => {
    return deployTokenMint(ctx);
  });
  logger.log(`Token mint deployed at ${tokenMintResult.contractAddress}`);

  logger.log('=== Deploying Counter Contract ===');
  const counterResult = await withAppContext(networkId, './counter/out', async (ctx) => {
    return deployCounter(ctx);
  });
  logger.log(`Counter deployed at ${counterResult.contractAddress}`);

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

  logger.log('=== Saving Contracts Config ===');
  saveContractsConfig(networkId, config);
  logger.log(`Config saved to .contracts.${networkId}.json`);

  return config;
}

runCli(main, { pretty: true });
