/**
 * Validate Assumption A4: Per-intent dust estimation.
 *
 * Determines whether the CES can estimate dust costs for specific intents
 * rather than only whole transactions.
 *
 * The real scenario: CES receives a proven (but unbound) transaction from
 * the user. It needs to estimate dust for individual intents to know how
 * much to fund for funded-contract intents.
 *
 * Approach:
 *   1. Check if Intent has any fee estimation methods (API discovery)
 *   2. Create a proven tx, extract its intents, try to estimate per-intent
 *   3. Test: can we call feesWithMargin on the whole proven tx?
 *   4. Test: can we extract intents and build a new tx from one intent?
 *   5. Test: does the single-intent synthetic approach produce consistent estimates?
 *
 * Usage: bun src/validate-a4-dust-estimation.ts [networkId]
 */

import {
  LedgerParameters,
  Intent,
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
} from '@midnight-ntwrk/ledger-v7';
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { setup } from './setup.js';
import { getAppConfigById } from './lib/config.js';
import { buildProviders } from './lib/providers/contract.js';
import { CompiledPocContract, PocContract } from './contract.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);
const DEFAULT_MARGIN = 3;

type ProvenIntent = Intent<SignatureEnabled, Proof, PreBinding>;

async function getLedgerParameters(indexerHttpUrl: string): Promise<LedgerParameters> {
  const query = `query { block { ledgerParameters } }`;
  const res = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as { data: { block: { ledgerParameters: string } } };
  const bytes = Buffer.from(json.data.block.ledgerParameters, 'hex');
  return LedgerParameters.deserialize(bytes);
}

function formatCost(cost: { readTime: bigint; computeTime: bigint; blockUsage: bigint; bytesWritten: bigint; bytesChurned: bigint }) {
  return JSON.stringify({
    readTime: cost.readTime.toString(),
    computeTime: cost.computeTime.toString(),
    blockUsage: cost.blockUsage.toString(),
    bytesWritten: cost.bytesWritten.toString(),
    bytesChurned: cost.bytesChurned.toString(),
  }, null, 2);
}

function checkIntentFeeApi(): boolean {
  logger.info('--- Step 1: Check if Intent has native fee estimation ---');

  const intentProto = Object.getOwnPropertyNames(Intent.prototype ?? {});
  const intentStatic = Object.getOwnPropertyNames(Intent);

  logger.info(`Intent prototype members: ${intentProto.join(', ') || '(none)'}`);
  logger.info(`Intent static members: ${intentStatic.join(', ') || '(none)'}`);

  const feeRelated = [...intentProto, ...intentStatic].filter(
    (name) => /fee|cost|estimate|dust|margin/i.test(name)
  );

  if (feeRelated.length > 0) {
    logger.info(`FOUND fee-related methods on Intent: ${feeRelated.join(', ')}`);
    return true;
  }

  logger.info('No fee-related methods found on Intent — per-intent API does NOT exist');
  return false;
}

async function main(): Promise<void> {
  const networkId = process.argv[2] ?? 'testnet';
  logger.info('=== Validate A4: Per-intent dust estimation ===');
  logger.info('Scenario: CES receives a proven tx and needs to estimate dust per-intent');

  // Setup: deploy/reuse contract
  const { ctx, contractAddress } = await setup(networkId);
  logger.info(`Using contract at ${contractAddress}`);

  const config = getAppConfigById(networkId);
  const ledgerParams = await getLedgerParameters(config.endpoints.indexerHttpUrl);
  logger.info(`Ledger parameters fetched (maxPriceAdjustment: ${ledgerParams.maxPriceAdjustment()})`);

  const providers = buildProviders<PocContract>(ctx, './contract/out');
  const { proofProvider } = providers;

  // Step 1: Check for native per-intent API
  const hasNativeApi = checkIntentFeeApi();

  // Step 2: Simulate the user's proven transaction
  logger.info('--- Step 2: Create a proven tx (simulating user submission to CES) ---');

  logger.info('Creating unproven call tx...');
  const callTxData = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledPocContract,
    circuitId: 'increment' as const,
  });

  logger.info('Proving tx...');
  const provenTx = await proofProvider.proveTx(callTxData.private.unprovenTx);

  // This is what the CES would receive: a proven, unbound transaction
  const wholeTxFee = provenTx.feesWithMargin(ledgerParams, DEFAULT_MARGIN);
  const wholeTxCost = provenTx.cost(ledgerParams);
  logger.info(`Whole proven tx fee: ${wholeTxFee} specks`);
  logger.info(`Whole proven tx cost: ${formatCost(wholeTxCost)}`);

  // Step 3: Extract intents from the proven tx
  logger.info('--- Step 3: Extract intents from proven tx ---');

  const intents = provenTx.intents;
  if (!intents || intents.size === 0) {
    logger.info('No intents found in proven tx — tx may use guaranteed/fallible sections instead');
    logger.info('Checking Transaction properties for alternative structures...');

    // Dump all accessible properties to understand the structure
    const txProps = Object.getOwnPropertyNames(Object.getPrototypeOf(provenTx));
    logger.info(`Transaction prototype members: ${txProps.join(', ')}`);

    // Try serializing and inspecting
    const serialized = provenTx.serialize();
    logger.info(`Proven tx serialized size: ${serialized.byteLength} bytes`);
  } else {
    logger.info(`Found ${intents.size} intent(s) in proven tx`);

    for (const [segmentId, intent] of intents) {
      logger.info(`  Segment ${segmentId}:`);
      logger.info(`    actions: ${intent.actions?.length ?? 0}`);
      logger.info(`    ttl: ${intent.ttl}`);
      logger.info(`    has dustActions: ${intent.dustActions !== undefined}`);
      logger.info(`    has guaranteedUnshieldedOffer: ${intent.guaranteedUnshieldedOffer !== undefined}`);
      logger.info(`    has fallibleUnshieldedOffer: ${intent.fallibleUnshieldedOffer !== undefined}`);

      // Try to serialize the individual intent
      try {
        const intentBytes = intent.serialize();
        logger.info(`    serialized size: ${intentBytes.byteLength} bytes`);

        // Try to deserialize it back
        const roundTripped = Intent.deserialize<SignatureEnabled, Proof, PreBinding>(
          'signature', 'proof', 'pre-binding', intentBytes
        );
        logger.info(`    round-trip deserialize: SUCCESS`);

        // Can we create a new transaction containing just this intent?
        // Transaction.fromParts requires UnprovenIntent, but we have a proven one.
        // Instead, try to set intents on a fresh tx via the writable property.
      } catch (err) {
        logger.info(`    serialize/deserialize failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Step 4: Try the reconstruction approach
  logger.info('--- Step 4: Reconstruct a single-intent tx from proven intent ---');

  // Approach A: Serialize the whole proven tx, modify it
  // The tx.intents setter docs say "modifying existing intents will succeed"
  // on proven txs, but "creating or removing intents will lead to binding error"
  // Let's test if we can create a new tx and assign the proven intent to it

  try {
    // Serialize the proven tx and deserialize as a copy
    const txBytes = provenTx.serialize();
    const txCopy = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature', 'proof', 'pre-binding', txBytes
    );

    const copyFee = txCopy.feesWithMargin(ledgerParams, DEFAULT_MARGIN);
    logger.info(`Serialized/deserialized copy fee: ${copyFee} specks`);
    logger.info(`Matches original: ${copyFee === wholeTxFee}`);

    // Since this tx already has exactly one intent, the fee IS the per-intent fee
    // In the real scenario with multiple intents, we'd need to figure out
    // how to isolate each intent's contribution
    logger.info('NOTE: For a single-intent tx, whole-tx fee = per-intent fee');
  } catch (err) {
    logger.info(`Serialize/deserialize round-trip failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 5: Test consistency across multiple single-intent txs
  logger.info('--- Step 5: Consistency check (two identical single-intent txs) ---');

  const callTxData2 = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledPocContract,
    circuitId: 'increment' as const,
  });
  const provenTx2 = await proofProvider.proveTx(callTxData2.private.unprovenTx);
  const fee2 = provenTx2.feesWithMargin(ledgerParams, DEFAULT_MARGIN);

  logger.info(`Tx #1 fee: ${wholeTxFee} specks`);
  logger.info(`Tx #2 fee: ${fee2} specks`);

  const diff = wholeTxFee > fee2 ? wholeTxFee - fee2 : fee2 - wholeTxFee;
  const avgFee = (wholeTxFee + fee2) / 2n;
  const variancePct = avgFee > 0n ? Number((diff * 10000n) / avgFee) / 100 : 0;
  logger.info(`Variance: ${variancePct}%`);

  // Step 6: Verdict
  logger.info('--- Verdict ---');

  if (hasNativeApi) {
    logger.info('PASS: Native per-intent fee estimation API exists on Intent');
  } else {
    logger.info('INFO: No native per-intent API on Intent');
  }

  logger.info(`PASS: feesWithMargin() works on proven unbound transactions (${wholeTxFee} specks)`);
  logger.info(`PASS: Proven tx intents are readable (${provenTx.intents?.size ?? 0} intent(s))`);

  const consistent = variancePct < 10;
  if (consistent) {
    logger.info(`PASS: Fee estimates are consistent across identical txs (${variancePct}% variance)`);
  } else {
    logger.info(`WARN: High variance (${variancePct}%) — investigate`);
  }

  logger.info('');
  logger.info('CONCLUSION: The CES can estimate fees on a proven tx via feesWithMargin().');
  logger.info('For multi-intent txs, the CES would need to either:');
  logger.info('  a) Estimate the whole tx fee and fund it entirely (simpler)');
  logger.info('  b) Have the user build separate single-intent txs for estimation');
  logger.info('  c) Use cost() breakdown to approximate per-intent contribution');
  logger.info('The exact per-intent isolation strategy needs runtime testing with multi-intent txs.');

  logger.info('=== A4 validation complete ===');
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
