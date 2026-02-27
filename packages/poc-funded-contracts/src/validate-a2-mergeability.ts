/**
 * Validate Assumption A2: Proven transaction mergeability.
 *
 * Proves that a user's proven (unbound) transaction can be merged with the
 * CES's dust transaction via the wallet's balanceTx() — i.e., proving
 * doesn't "seal" the transaction.
 *
 * The CES scenario:
 *   1. User creates and proves a call tx (contract interaction)
 *   2. User sends the proven unbound tx to the CES
 *   3. CES calls walletProvider.balanceTx(provenTx) which internally:
 *      - Creates a dust spend from the CES dust wallet
 *      - Merges the dust tx with the user's proven tx
 *      - Binds and finalizes the merged tx
 *   4. CES submits the merged+finalized tx to the network
 *
 * Usage: bun src/validate-a2-mergeability.ts [networkId=preprod]
 */

import {
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v7';
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { setup } from './setup.js';
import { buildProviders } from './lib/providers/contract.js';
import { CompiledPocContract, PocContract } from './contract.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);

async function main(): Promise<void> {
  const networkId = process.argv[2] ?? 'preprod';
  logger.info('=== Validate A2: Proven tx mergeability ===');
  logger.info('Scenario: CES receives a proven tx, merges with dust, and submits');

  // Setup
  const { ctx, contractAddress } = await setup(networkId);
  logger.info(`Using contract at ${contractAddress}`);

  const providers = buildProviders<PocContract>(ctx, './contract/out');
  const { proofProvider, walletProvider, midnightProvider } = providers;

  // Step 1: User creates and proves a call tx
  logger.info('--- Step 1: User creates and proves a call tx ---');
  const callTxData = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledPocContract,
    circuitId: 'increment' as const,
  });

  const unprovenTx = callTxData.private.unprovenTx;
  logger.info(`Unproven tx: ${unprovenTx.serialize().byteLength} bytes`);
  logger.info(`  intents: ${unprovenTx.intents?.size ?? 0}`);
  logger.info(`  guaranteedOffer: ${unprovenTx.guaranteedOffer ? 'present' : 'undefined'}`);
  logger.info(`  fallibleOffer: ${unprovenTx.fallibleOffer ? `Map(${unprovenTx.fallibleOffer.size})` : 'undefined'}`);

  logger.info('Proving tx (simulating user-side proving)...');
  const provenTx = await proofProvider.proveTx(unprovenTx);
  const provenBytes = provenTx.serialize();
  logger.info(`Proven unbound tx: ${provenBytes.byteLength} bytes`);
  logger.info(`  intents: ${provenTx.intents?.size ?? 0}`);
  logger.info(`  guaranteedOffer: ${provenTx.guaranteedOffer ? 'present' : 'undefined'}`);
  logger.info(`  fallibleOffer: ${provenTx.fallibleOffer ? `Map(${provenTx.fallibleOffer.size})` : 'undefined'}`);

  // Step 2: CES receives the proven tx and balances it (merge + bind + finalize)
  logger.info('--- Step 2: CES balances the proven tx (merge + bind + finalize) ---');
  logger.info('Calling walletProvider.balanceTx(provenTx)...');

  let finalizedTx: FinalizedTransaction;
  try {
    finalizedTx = await walletProvider.balanceTx(provenTx);
    logger.info('PASS: balanceTx() succeeded — merge + bind + finalize complete');
  } catch (err) {
    logger.info(`FAIL: balanceTx() failed — ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      logger.info(err.stack);
    }
    logger.info('');
    logger.info('=== VERDICT: FAIL — Cannot merge proven tx with dust ===');
    return;
  }

  // Step 3: Inspect the finalized (merged) tx
  logger.info('--- Step 3: Inspect finalized (merged) tx ---');
  const finalizedBytes = finalizedTx.serialize();
  logger.info(`Finalized tx: ${finalizedBytes.byteLength} bytes`);
  logger.info(`  intents: ${finalizedTx.intents?.size ?? 0}`);
  logger.info(`  guaranteedOffer: ${finalizedTx.guaranteedOffer ? 'present' : 'undefined'}`);
  logger.info(`  fallibleOffer: ${finalizedTx.fallibleOffer ? `Map(${finalizedTx.fallibleOffer.size})` : 'undefined'}`);

  let txHash: string | undefined;
  try {
    txHash = finalizedTx.transactionHash();
    logger.info(`  transactionHash: ${txHash}`);
  } catch {
    logger.info('  transactionHash: NOT AVAILABLE');
  }

  const txIds = finalizedTx.identifiers();
  logger.info(`  identifiers: [${txIds.join(', ')}]`);

  // Compare before vs after
  const beforeIntents = provenTx.intents?.size ?? 0;
  const afterIntents = finalizedTx.intents?.size ?? 0;
  const beforeOffers = (provenTx.guaranteedOffer ? 1 : 0) + (provenTx.fallibleOffer?.size ?? 0);
  const afterOffers = (finalizedTx.guaranteedOffer ? 1 : 0) + (finalizedTx.fallibleOffer?.size ?? 0);

  logger.info('');
  logger.info('Before vs. after balanceTx():');
  logger.info(`  Tx size: ${provenBytes.byteLength} → ${finalizedBytes.byteLength} bytes (+${finalizedBytes.byteLength - provenBytes.byteLength})`);
  logger.info(`  Intents: ${beforeIntents} → ${afterIntents}`);
  logger.info(`  Offers: ${beforeOffers} → ${afterOffers}`);

  if (finalizedBytes.byteLength > provenBytes.byteLength) {
    logger.info('  → Tx grew in size — dust/balancing data was merged in');
  }

  // Step 4: Submit to network
  logger.info('--- Step 4: Submit merged tx to network ---');
  let submittedId: string;
  try {
    submittedId = await midnightProvider.submitTx(finalizedTx);
    logger.info(`PASS: Tx submitted and finalized — id: ${submittedId}`);
  } catch (err) {
    logger.info(`FAIL: Submit failed — ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      logger.info(err.stack);
    }
    logger.info('');
    logger.info('=== VERDICT: PARTIAL — Merge succeeded but submit failed ===');
    return;
  }

  // Step 5: Verdict
  logger.info('');
  logger.info('=== VERDICT ===');
  logger.info(`User tx proven (unbound): PASS (${provenBytes.byteLength} bytes)`);
  logger.info(`CES balanceTx (merge + bind + finalize): PASS (${finalizedBytes.byteLength} bytes)`);
  logger.info(`Submit merged tx to network: PASS (id: ${submittedId})`);
  logger.info('');
  logger.info('CONCLUSION: A user\'s proven tx CAN be merged with CES dust and submitted.');
  logger.info('The CES workflow is: receive proven tx → balanceTx() → submitTx().');
  logger.info('Proving does NOT seal the transaction — merging works as expected.');

  logger.info('=== A2 validation complete ===');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Fatal:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
);
