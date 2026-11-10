import { program } from 'commander';
import { runCli, shouldStoreMaintenanceKey, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy as deployCounter } from './counter/lib/operations.js';
import { deploy as deployTokenMint } from './token-mint/lib/operations.js';
import { saveContractsConfig, ContractsConfig } from './lib/contracts-config.js';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import type { SigningKey } from '@midnight-ntwrk/compact-runtime';

const logger = createLogger(import.meta);

interface MaintenanceKeyOutput {
  contractAddress: string;
  signingKey: SigningKey;
  /** Absent when the key was not stored in Secrets Manager. */
  secretArn?: string;
}

/**
 * The CLI output. The maintenance keys are kept apart from `config`, which is saved and copied to
 * the browser-facing demo: they are printed here so they are never lost, but never saved with it.
 */
interface DeployAllOutput {
  config: ContractsConfig;
  maintenanceKeys: { tokenMint: MaintenanceKeyOutput; counter: MaintenanceKeyOutput };
}

async function main(): Promise<DeployAllOutput> {
  program
    .name('deploy-all')
    .description('Deploy all contracts and save config')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .option('--dry-run', 'Build, prove, and balance transactions without submitting')
    .option(
      '--no-maintenance-key-secret',
      'Do not store the maintenance signing keys in Secrets Manager (refused on mainnet)'
    )
    .parse();

  const [networkId] = program.args;
  const { dryRun, maintenanceKeySecret } = program.opts<{ dryRun?: boolean; maintenanceKeySecret: boolean }>();
  const store = shouldStoreMaintenanceKey(networkId, maintenanceKeySecret);

  if (dryRun) {
    logger.info('*** DRY RUN MODE — transactions will not be submitted ***');
  }

  logger.info('=== Deploying Token Mint Contract ===');
  const tokenMintResult = await withAppContextFromEnv(networkId, async (ctx) => {
    return deployTokenMint(ctx, undefined, dryRun, store);
  });
  logger.info(`Token mint deployed at ${tokenMintResult.contractAddress}`);

  logger.info('=== Deploying Counter Contract ===');
  const counterResult = await withAppContextFromEnv(networkId, async (ctx) => {
    return deployCounter(ctx, dryRun, store);
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

  return {
    config,
    maintenanceKeys: {
      tokenMint: {
        contractAddress: tokenMintResult.contractAddress,
        signingKey: tokenMintResult.maintenanceSigningKey,
        secretArn: tokenMintResult.maintenanceKeySecretArn,
      },
      counter: {
        contractAddress: counterResult.contractAddress,
        signingKey: counterResult.maintenanceSigningKey,
        secretArn: counterResult.maintenanceKeySecretArn,
      },
    },
  };
}

runCli(main, { pretty: true });
