import { setup, callIncrement, queryCounter } from './setup.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);

async function main(): Promise<void> {
  const networkId = process.argv[2] ?? 'preprod';
  logger.info(`=== Funded Contracts PoC — Scaffold Verification ===`);

  const { ctx, contractAddress, txHash } = await setup(networkId);
  logger.info(`Contract address: ${contractAddress}`);
  logger.info(`Deploy tx: ${txHash}`);

  logger.info('Calling increment to verify contract interaction...');
  const incrementTxHash = await callIncrement(ctx, contractAddress);
  logger.info(`Increment tx: ${incrementTxHash}`);

  const counterValue = await queryCounter(ctx, contractAddress);
  logger.info(`Counter value after increment: ${counterValue}`);

  logger.info('=== Scaffold verification complete ===');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Fatal:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
