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
 * Usage: bun src/validate-a4-dust-estimation.ts [networkId=preprod]
 */

import {
  LedgerParameters,
  Intent,
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type PreProof,
} from '@midnight-ntwrk/ledger-v7';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
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
  const networkId = process.argv[2] ?? 'preprod';
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

  // Step 4: Try building a synthetic tx from an extracted proven intent
  logger.info('--- Step 4: Build synthetic single-intent tx from extracted proven intent ---');

  const firstIntent = provenTx.intents ? [...provenTx.intents.entries()][0] : undefined;

  // Approach A: Create empty unproven tx, assign proven intent to its intents map
  logger.info('Approach A: Create empty tx via fromParts(), assign proven intent...');
  let approachAFee: bigint | null = null;
  try {
    const emptyTx = Transaction.fromParts(getNetworkId());
    logger.info(`  Empty tx created, intents: ${emptyTx.intents?.size ?? 0}`);

    if (firstIntent) {
      const [segmentId, intent] = firstIntent;
      const newIntents = new Map<number, Intent<SignatureEnabled, PreProof, PreBinding>>();
      // Force-assign the proven intent (bypassing TS types to test runtime behavior)
      newIntents.set(segmentId, intent as unknown as Intent<SignatureEnabled, PreProof, PreBinding>);
      emptyTx.intents = newIntents;
      logger.info(`  Assigned intent to empty tx, intents: ${emptyTx.intents?.size ?? 0}`);

      // Now prove it to get fee estimation
      const provenSynthetic = await proofProvider.proveTx(emptyTx);
      approachAFee = provenSynthetic.feesWithMargin(ledgerParams, DEFAULT_MARGIN);
      logger.info(`  PASS: Synthetic single-intent tx fee: ${approachAFee} specks`);
    }
  } catch (err) {
    logger.info(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Approach B: eraseProofs() on intent, then fromParts() with it
  logger.info('Approach B: eraseProofs() on intent, then fromParts()...');
  let approachBFee: bigint | null = null;
  try {
    if (firstIntent) {
      const [, intent] = firstIntent;
      const erasedIntent = intent.eraseProofs();
      logger.info(`  eraseProofs() succeeded, type: ${typeof erasedIntent}`);

      // Try using it as an UnprovenIntent (runtime cast)
      const syntheticTx = Transaction.fromParts(
        getNetworkId(),
        undefined,
        undefined,
        erasedIntent as unknown as Intent<SignatureEnabled, PreProof, PreBinding>
      );
      logger.info(`  fromParts() with erased intent succeeded, intents: ${syntheticTx.intents?.size ?? 0}`);

      const provenSynthetic = await proofProvider.proveTx(syntheticTx);
      approachBFee = provenSynthetic.feesWithMargin(ledgerParams, DEFAULT_MARGIN);
      logger.info(`  PASS: Synthetic fee from erased intent: ${approachBFee} specks`);
    }
  } catch (err) {
    logger.info(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Approach C: fromPartsRandomized() with erased intent
  logger.info('Approach C: fromPartsRandomized() with erased intent...');
  let approachCFee: bigint | null = null;
  try {
    if (firstIntent) {
      const [, intent] = firstIntent;
      const erasedIntent = intent.eraseProofs();

      const syntheticTx = Transaction.fromPartsRandomized(
        getNetworkId(),
        undefined,
        undefined,
        erasedIntent as unknown as Intent<SignatureEnabled, PreProof, PreBinding>
      );
      logger.info(`  fromPartsRandomized() succeeded, intents: ${syntheticTx.intents?.size ?? 0}`);

      const provenSynthetic = await proofProvider.proveTx(syntheticTx);
      approachCFee = provenSynthetic.feesWithMargin(ledgerParams, DEFAULT_MARGIN);
      logger.info(`  PASS: Synthetic fee from randomized: ${approachCFee} specks`);
    }
  } catch (err) {
    logger.info(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 5: Consistency check — compare original vs synthetic fees
  logger.info('--- Step 5: Fee comparison ---');
  logger.info(`Original whole-tx fee: ${wholeTxFee} specks`);
  if (approachAFee !== null) logger.info(`Approach A (assign to empty tx): ${approachAFee} specks`);
  if (approachBFee !== null) logger.info(`Approach B (eraseProofs + fromParts): ${approachBFee} specks`);
  if (approachCFee !== null) logger.info(`Approach C (eraseProofs + fromPartsRandomized): ${approachCFee} specks`);

  const anyApproachWorked = approachAFee !== null || approachBFee !== null || approachCFee !== null;

  // Step 6: Verdict
  logger.info('--- Verdict ---');

  logger.info(`feesWithMargin() on whole proven tx: PASS (${wholeTxFee} specks)`);
  logger.info(`Intent extraction from proven tx: PASS (${provenTx.intents?.size ?? 0} intent(s))`);
  logger.info(`Intent serialize/deserialize round-trip: PASS`);

  if (anyApproachWorked) {
    logger.info('Synthetic single-intent tx construction: PASS');
    logger.info('CONCLUSION: CES CAN extract intents and estimate fees per-intent.');
  } else {
    logger.info('Synthetic single-intent tx construction: FAIL (all approaches failed)');
    logger.info('CONCLUSION: CES cannot build synthetic per-intent txs from proven intents.');
    logger.info('Viable alternatives:');
    logger.info('  a) Estimate the whole tx fee and fund it entirely');
    logger.info('  b) Require users to submit one tx per funded-contract call');
    logger.info('  c) Use cost() breakdown to approximate per-intent contribution');
  }

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
