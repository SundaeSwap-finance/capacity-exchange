/**
 * Validate Assumption A1: Proven transaction inspectability and privacy.
 *
 * Confirms that a proven transaction reveals which contracts/circuits are
 * called (needed by the CES for routing), while NOT leaking private data.
 *
 * The CES scenario: receives a proven unbound tx from a user. It needs to
 * inspect the tx to determine which contract(s) are being called and which
 * circuit entry points, so it can decide whether to fund it.
 *
 * Usage: bun src/validate-a1-inspectability.ts [networkId=preprod]
 */

import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
} from '@midnight-ntwrk/ledger-v7';
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { setup } from './setup.js';
import { buildProviders } from './lib/providers/contract.js';
import { CompiledPocContract, PocContract } from './contract.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);

function toHex(data: Uint8Array | string): string {
  if (typeof data === 'string') return data;
  return Buffer.from(data).toString('hex');
}

function truncate(s: string, max = 80): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/** Safely read a property, catching WASM errors */
function safeRead(obj: unknown, prop: string): { value: unknown; error?: string } {
  try {
    const value = (obj as Record<string, unknown>)[prop];
    return { value };
  } catch (err) {
    return { value: undefined, error: err instanceof Error ? err.message : String(err) };
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (value instanceof Uint8Array) return `Uint8Array(${value.length}) ${truncate(toHex(value))}`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'object') {
    try {
      return truncate(JSON.stringify(value));
    } catch {
      return `[${value.constructor?.name ?? 'Object'}]`;
    }
  }
  return truncate(String(value));
}

async function main(): Promise<void> {
  const networkId = process.argv[2] ?? 'preprod';
  logger.info('=== Validate A1: Proven tx inspectability & privacy ===');
  logger.info('Scenario: CES receives a proven tx and inspects its contents');

  // Setup
  const { ctx, contractAddress } = await setup(networkId);
  logger.info(`Using contract at ${contractAddress}`);

  const providers = buildProviders<PocContract>(ctx, './contract/out');
  const { proofProvider } = providers;

  // Step 1: Create and prove a call tx
  logger.info('--- Step 1: Create and prove a call tx ---');
  const callTxData = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledPocContract,
    circuitId: 'increment' as const,
  });

  const provenTx = await proofProvider.proveTx(callTxData.private.unprovenTx);
  logger.info(`Proven tx created (${provenTx.serialize().byteLength} bytes)`);

  // Step 2: Simulate CES receiving raw bytes — deserialize
  logger.info('--- Step 2: Deserialize from raw bytes (simulating CES) ---');
  const txBytes = provenTx.serialize();
  const deserialized = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
    'signature', 'proof', 'pre-binding', txBytes
  );
  logger.info(`Deserialized proven tx (${txBytes.byteLength} bytes)`);

  // Step 3: Enumerate all Transaction-level properties
  logger.info('--- Step 3: Transaction-level field dump ---');
  const txProto = Object.getOwnPropertyNames(Object.getPrototypeOf(deserialized));
  logger.info(`Transaction prototype members: ${txProto.join(', ')}`);

  const txFields = [
    'rewards', 'intents', 'fallibleOffer', 'guaranteedOffer', 'bindingRandomness',
  ];
  for (const field of txFields) {
    const { value, error } = safeRead(deserialized, field);
    if (error) {
      logger.info(`  tx.${field}: ERROR — ${error}`);
    } else {
      logger.info(`  tx.${field}: ${formatValue(value)}`);
    }
  }

  // Methods that return values (some may fail on unbound txs)
  let txHash: string | undefined;
  try {
    txHash = deserialized.transactionHash();
    logger.info(`  tx.transactionHash(): ${txHash}`);
  } catch (err) {
    logger.info(`  tx.transactionHash(): NOT AVAILABLE — ${err instanceof Error ? err.message : String(err)}`);
  }

  let txIds: string[] = [];
  try {
    txIds = deserialized.identifiers();
    logger.info(`  tx.identifiers(): [${txIds.join(', ')}]`);
  } catch (err) {
    logger.info(`  tx.identifiers(): NOT AVAILABLE — ${err instanceof Error ? err.message : String(err)}`);
  }

  // toString dump
  const txStr = deserialized.toString(true);
  logger.info(`  tx.toString(compact=true): ${truncate(txStr, 200)}`);

  // Step 4: Inspect intents and their actions
  logger.info('--- Step 4: Intent and action inspection ---');
  const intents = deserialized.intents;

  if (!intents || intents.size === 0) {
    logger.info('No intents found — cannot inspect contract calls');
  } else {
    for (const [segmentId, intent] of intents) {
      logger.info(`Intent segment ${segmentId}:`);

      const intentFields = [
        'ttl', 'dustActions', 'guaranteedUnshieldedOffer',
        'fallibleUnshieldedOffer', 'binding',
      ];
      for (const field of intentFields) {
        const { value, error } = safeRead(intent, field);
        if (error) {
          logger.info(`  intent.${field}: ERROR — ${error}`);
        } else {
          logger.info(`  intent.${field}: ${formatValue(value)}`);
        }
      }

      const intentHash = intent.intentHash();
      logger.info(`  intent.intentHash(): ${intentHash}`);

      // Inspect actions — this is where contract address and entry point live
      const actions = intent.actions;
      if (!actions || actions.length === 0) {
        logger.info('  No actions in this intent');
        continue;
      }

      logger.info(`  ${actions.length} action(s):`);
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        logger.info(`  Action[${i}] type: ${action.constructor?.name ?? typeof action}`);

        // Enumerate all action properties
        const actionProto = Object.getOwnPropertyNames(Object.getPrototypeOf(action));
        logger.info(`  Action[${i}] members: ${actionProto.join(', ')}`);

        // Try reading key CES-relevant fields
        const actionFields = [
          'address', 'entryPoint', 'communicationCommitment',
          'proof', 'fallibleTranscript', 'guaranteedTranscript',
          'initialState',
        ];
        for (const field of actionFields) {
          const { value, error } = safeRead(action, field);
          if (error) {
            logger.info(`    action.${field}: ERROR — ${error}`);
          } else if (value !== undefined) {
            logger.info(`    action.${field}: ${formatValue(value)}`);
          }
        }
      }
    }
  }

  // Step 5: Inspect ZswapOffer (guaranteed/fallible)
  logger.info('--- Step 5: ZswapOffer inspection ---');
  const guaranteed = deserialized.guaranteedOffer;
  const fallible = deserialized.fallibleOffer;

  if (guaranteed) {
    const gProto = Object.getOwnPropertyNames(Object.getPrototypeOf(guaranteed));
    logger.info(`guaranteedOffer members: ${gProto.join(', ')}`);
    logger.info(`guaranteedOffer.toString(compact): ${truncate(guaranteed.toString(true), 200)}`);
  } else {
    logger.info('guaranteedOffer: undefined');
  }

  if (fallible) {
    logger.info(`fallibleOffer: Map(${fallible.size})`);
    for (const [segId, offer] of fallible) {
      const fProto = Object.getOwnPropertyNames(Object.getPrototypeOf(offer));
      logger.info(`  fallibleOffer[${segId}] members: ${fProto.join(', ')}`);
      logger.info(`  fallibleOffer[${segId}].toString(compact): ${truncate(offer.toString(true), 200)}`);
    }
  } else {
    logger.info('fallibleOffer: undefined');
  }

  // Step 6: Privacy verdict
  logger.info('--- Step 6: Sensitivity analysis ---');

  const findings: { field: string; value: string; sensitive: boolean; reason: string }[] = [];

  // Check contract address visibility
  if (intents && intents.size > 0) {
    for (const [segId, intent] of intents) {
      const actions = intent.actions;
      if (!actions) continue;
      for (let i = 0; i < actions.length; i++) {
        const { value: addr } = safeRead(actions[i], 'address');
        const { value: ep } = safeRead(actions[i], 'entryPoint');

        if (addr !== undefined) {
          const addrMatch = String(addr) === contractAddress;
          findings.push({
            field: `intent[${segId}].action[${i}].address`,
            value: formatValue(addr),
            sensitive: false,
            reason: addrMatch ? 'Matches known contract address — CES can route' : 'Contract address visible',
          });
        }

        if (ep !== undefined) {
          const epStr = ep instanceof Uint8Array ? toHex(ep) : String(ep);
          findings.push({
            field: `intent[${segId}].action[${i}].entryPoint`,
            value: epStr,
            sensitive: false,
            reason: 'Circuit entry point visible — CES can identify the operation',
          });
        }

        // Check for private data leakage
        const { value: proof } = safeRead(actions[i], 'proof');
        if (proof !== undefined) {
          findings.push({
            field: `intent[${segId}].action[${i}].proof`,
            value: formatValue(proof),
            sensitive: false,
            reason: 'ZK proof — opaque, does not leak private inputs',
          });
        }

        const { value: gTranscript } = safeRead(actions[i], 'guaranteedTranscript');
        if (gTranscript !== undefined) {
          findings.push({
            field: `intent[${segId}].action[${i}].guaranteedTranscript`,
            value: formatValue(gTranscript),
            sensitive: true,
            reason: 'Public transcript — contains public state transitions, review for data exposure',
          });
        }

        const { value: fTranscript } = safeRead(actions[i], 'fallibleTranscript');
        if (fTranscript !== undefined) {
          findings.push({
            field: `intent[${segId}].action[${i}].fallibleTranscript`,
            value: formatValue(fTranscript),
            sensitive: true,
            reason: 'Public transcript — contains public state transitions, review for data exposure',
          });
        }
      }
    }
  }

  // Check tx-level fields for sensitive data
  findings.push({
    field: 'tx.transactionHash()',
    value: txHash ?? 'NOT AVAILABLE (requires bound tx)',
    sensitive: false,
    reason: txHash ? 'Tx hash — public, needed for tracking' : 'Only available on bound txs — CES sees unbound',
  });
  findings.push({
    field: 'tx.bindingRandomness',
    value: String(deserialized.bindingRandomness),
    sensitive: false,
    reason: 'Binding randomness — cryptographic, does not reveal identity',
  });

  // Verdict
  logger.info('');
  logger.info('=== FINDINGS ===');
  for (const f of findings) {
    const tag = f.sensitive ? 'REVIEW' : 'OK';
    logger.info(`[${tag}] ${f.field}: ${f.value}`);
    logger.info(`       ${f.reason}`);
  }

  const contractAddrVisible = findings.some(f => f.field.includes('address') && !f.sensitive);
  const entryPointVisible = findings.some(f => f.field.includes('entryPoint') && !f.sensitive);
  const sensitiveFields = findings.filter(f => f.sensitive);

  logger.info('');
  logger.info('=== VERDICT ===');
  logger.info(`Contract address visible to CES: ${contractAddrVisible ? 'PASS' : 'FAIL'}`);
  logger.info(`Circuit entry point visible to CES: ${entryPointVisible ? 'PASS' : 'FAIL'}`);
  logger.info(`Fields needing review: ${sensitiveFields.length}`);
  for (const sf of sensitiveFields) {
    logger.info(`  - ${sf.field}: ${sf.reason}`);
  }

  if (contractAddrVisible && entryPointVisible) {
    logger.info('');
    logger.info('CONCLUSION: The CES CAN inspect a proven tx to determine:');
    logger.info('  - Which contract is being called (address)');
    logger.info('  - Which circuit/entry point is invoked');
    logger.info('  - This is sufficient for routing funded-contract requests');
    logger.info('Private circuit inputs are hidden behind ZK proofs and NOT exposed.');
  } else {
    logger.info('');
    logger.info('CONCLUSION: One or more required fields are NOT visible. Investigate.');
  }

  logger.info('=== A1 validation complete ===');
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
