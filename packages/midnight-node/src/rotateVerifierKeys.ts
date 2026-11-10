import * as fs from 'fs';
import * as path from 'path';
import {
  ContractOperationVersion,
  ContractOperationVersionedVerifierKey,
  ContractState,
  Intent,
  MaintenanceUpdate,
  Transaction,
  VerifierKeyInsert,
  VerifierKeyRemove,
  signData,
  signatureVerifyingKey,
  signingKeyFromBip340,
  type SingleUpdate,
  type SigningKey,
} from '@midnightntwrk/ledger-v9';
import { loadLedger8Protocol } from '@midnight-ntwrk/midnight-js-protocol';
import { submitTx } from '@midnight-ntwrk/midnight-js/contracts';
import { LedgerTransaction, SucceedEntirely, type PublicDataProvider } from '@midnight-ntwrk/midnight-js/types';
import { DEFAULT_TX_TTL_SECONDS, hexToBytes } from '@sundaeswap/capacity-exchange-core';
import type { AppContext } from './appContext.js';
import { buildProviders } from './providers.js';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

/**
 * Operation versions, as the ledger tags each verifier key. Contracts deployed before the ledger 9
 * hard fork hold `v3` keys (ZKIR 2); the ledger 9 toolchain proves against `v4` keys (ZKIR 3). The
 * ledger keeps both side by side, so a `v4` key can be added without touching the `v3` one.
 */
const LEGACY_VERSION = 'v3';
const CURRENT_VERSION = 'v4';

/**
 * - `insert`: add each circuit's recompiled (`v4`) verifier key next to the deployed one. Calls
 *   proved with either toolchain verify while both are present, so nothing is ever uncallable.
 * - `remove-legacy`: drop the pre-fork (`v3`) keys once the new ones are in place, so the ledger
 *   stops accepting proofs from the old toolchain.
 * - `reinsert`: testing only. Replace each circuit's current (`v4`) key with the identical local
 *   key, removing and re-inserting it in one update. A no-op for the contract, but it exercises
 *   the full signed maintenance path on a contract deployed after the fork, which has no `v3` keys.
 */
export type RotationMode = 'insert' | 'remove-legacy' | 'reinsert';

export interface RotateVerifierKeysOptions {
  contractAddress: string;
  /** The contract's compiled output directory, holding `keys/<circuit>.verifier`. */
  outDir: string;
  /** A key in the contract's maintenance authority committee. */
  signingKey: SigningKey;
  mode: RotationMode;
  /** Circuits to act on. Defaults to every circuit with a local verifier key. */
  circuits?: string[];
  /** Prove and balance the maintenance transaction without submitting it. */
  dryRun?: boolean;
}

export type CircuitKeyStatus = 'matches-local' | 'differs-from-local' | 'not-on-chain';

export interface RotateVerifierKeysResult {
  contractAddress: string;
  mode: RotationMode;
  /** The ledger era of the state the indexer served: `v8` until a post-fork transaction touches the contract. */
  stateEra: string;
  before: Record<string, CircuitKeyStatus>;
  /** Circuits the maintenance update covers. Empty when there was nothing to do. */
  updated: string[];
  skipped: { circuit: string; reason: string }[];
  dryRun: boolean;
  txHash?: string;
  after?: Record<string, CircuitKeyStatus>;
}

/** The parts of a deployed contract's state the rotation reads, whichever ledger wrote it. */
interface OnChainContract {
  era: string;
  committee: string[];
  threshold: number;
  counter: bigint;
  verifierKeys: Map<string, Uint8Array | undefined>;
}

const operationName = (op: string | Uint8Array): string => (typeof op === 'string' ? op : new TextDecoder().decode(op));

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Parses a maintenance signing key from a file's contents: either the 64-character hex BIP-340
 * key that midnight-js stored before the fork, or the ledger 9 `{ "tag", "value" }` form.
 */
export function parseSigningKey(contents: string): SigningKey {
  const text = contents.trim();
  if (text.startsWith('{')) {
    const parsed = JSON.parse(text) as Partial<SigningKey>;
    if ((parsed.tag === 'schnorr' || parsed.tag === 'ecdsa') && typeof parsed.value === 'string') {
      return { tag: parsed.tag, value: parsed.value };
    }
    throw new Error('Signing key JSON must be { "tag": "schnorr" | "ecdsa", "value": "<hex>" }');
  }
  if (/^[0-9a-fA-F]{64}$/.test(text)) {
    return signingKeyFromBip340(hexToBytes(text));
  }
  throw new Error('Signing key must be 64 hex characters (BIP-340) or { "tag", "value" } JSON');
}

/** Reads every `keys/<circuit>.verifier` file in a compiled contract's output directory. */
export function readLocalVerifierKeys(outDir: string): Map<string, Uint8Array> {
  const keysDir = path.join(outDir, 'keys');
  if (!fs.existsSync(keysDir)) {
    throw new Error(`No keys directory at ${keysDir}; compile the contract first`);
  }
  const keys = new Map<string, Uint8Array>();
  for (const file of fs.readdirSync(keysDir)) {
    if (file.endsWith('.verifier')) {
      keys.set(file.slice(0, -'.verifier'.length), new Uint8Array(fs.readFileSync(path.join(keysDir, file))));
    }
  }
  return keys;
}

/** Reads the contract's committee, counter and verifier keys with the runtime of the era that wrote its state. */
async function readOnChainContract(
  publicDataProvider: PublicDataProvider,
  contractAddress: string
): Promise<OnChainContract> {
  const read = await publicDataProvider.queryContractState(contractAddress);
  if (!read) {
    throw new Error(`No contract found at ${contractAddress}`);
  }
  const bytes = read.contractState.serialize();
  const era = read.contractState.era;
  if (era === 'v9') {
    const state = ContractState.deserialize(bytes);
    return {
      era,
      committee: state.maintenanceAuthority.committee.map((key) => key.value),
      threshold: state.maintenanceAuthority.threshold,
      counter: state.maintenanceAuthority.counter,
      verifierKeys: new Map(state.operations().map((op) => [operationName(op), state.operation(op)?.verifierKey])),
    };
  }
  // Not yet touched since the fork: read it with the ledger 8 runtime. Ledger 8 keys are bare hex
  // and match the `value` of the same key under ledger 9.
  const v8 = await loadLedger8Protocol();
  const state = v8.ContractState.deserialize(bytes);
  return {
    era,
    committee: [...state.maintenanceAuthority.committee],
    threshold: state.maintenanceAuthority.threshold,
    counter: state.maintenanceAuthority.counter,
    verifierKeys: new Map(state.operations().map((op) => [operationName(op), state.operation(op)?.verifierKey])),
  };
}

function keyStatus(onChain: OnChainContract, circuit: string, local: Uint8Array): CircuitKeyStatus {
  if (!onChain.verifierKeys.has(circuit)) {
    return 'not-on-chain';
  }
  const deployed = onChain.verifierKeys.get(circuit);
  return deployed && bytesEqual(deployed, local) ? 'matches-local' : 'differs-from-local';
}

function statuses(onChain: OnChainContract, local: Map<string, Uint8Array>, circuits: string[]) {
  return Object.fromEntries(circuits.map((c) => [c, keyStatus(onChain, c, local.get(c)!)]));
}

/** Where `signingKey` sits in the committee. Refuses keys that cannot approve an update alone. */
function signerIndex(onChain: OnChainContract, signingKey: SigningKey): bigint {
  const verifyingKey = signatureVerifyingKey(signingKey).value;
  const index = onChain.committee.indexOf(verifyingKey);
  if (index < 0) {
    throw new Error(
      `Signing key (verifying key ${verifyingKey}) is not in the contract's maintenance committee: ` +
        `[${onChain.committee.join(', ')}]`
    );
  }
  if (onChain.threshold > 1) {
    throw new Error(`The maintenance authority needs ${onChain.threshold} signatures; this tool signs with one key`);
  }
  return BigInt(index);
}

/** Decides which circuits the update covers, and why the rest are left alone. */
function planUpdates(
  mode: RotationMode,
  before: Record<string, CircuitKeyStatus>,
  local: Map<string, Uint8Array>
): { updates: SingleUpdate[]; updated: string[]; skipped: RotateVerifierKeysResult['skipped'] } {
  const updates: SingleUpdate[] = [];
  const updated: string[] = [];
  const skipped: RotateVerifierKeysResult['skipped'] = [];
  for (const [circuit, status] of Object.entries(before)) {
    if (status === 'not-on-chain') {
      skipped.push({ circuit, reason: 'the deployed contract has no such operation' });
      continue;
    }
    if (mode === 'insert') {
      if (status === 'matches-local') {
        skipped.push({ circuit, reason: 'the deployed key already matches the local one' });
        continue;
      }
      const vk = new ContractOperationVersionedVerifierKey(CURRENT_VERSION, local.get(circuit)!);
      updates.push(new VerifierKeyInsert(circuit, vk));
    } else if (mode === 'reinsert') {
      if (status !== 'matches-local') {
        // Only a contract already on the local keys can be reinserted without changing anything.
        throw new Error(
          `Circuit '${circuit}' does not have the local key on chain; reinsert only replaces identical keys`
        );
      }
      const vk = new ContractOperationVersionedVerifierKey(CURRENT_VERSION, local.get(circuit)!);
      updates.push(new VerifierKeyRemove(circuit, new ContractOperationVersion(CURRENT_VERSION)));
      updates.push(new VerifierKeyInsert(circuit, vk));
    } else {
      if (status !== 'matches-local') {
        // Removing the old key before the new one is live would leave the circuit uncallable.
        throw new Error(`Circuit '${circuit}' does not have the local key on chain yet; run the insert first`);
      }
      updates.push(new VerifierKeyRemove(circuit, new ContractOperationVersion(LEGACY_VERSION)));
    }
    updated.push(circuit);
  }
  return { updates, updated, skipped };
}

/**
 * Brings a deployed contract's verifier keys in line with the local (ledger 9) compile, using its
 * maintenance authority. All circuits go in one signed maintenance update, so they change together.
 *
 * midnight-js's `submitInsertVerifierKeyTx` cannot do this for a contract deployed before the fork:
 * it refuses any circuit that already has a key, and its remove only targets `v4` keys. This builds
 * the ledger 9 maintenance update directly instead, the way compact-js does internally.
 */
export async function rotateVerifierKeys(
  ctx: AppContext,
  options: RotateVerifierKeysOptions
): Promise<RotateVerifierKeysResult> {
  const { contractAddress, outDir, signingKey, mode, dryRun = false } = options;

  const local = readLocalVerifierKeys(outDir);
  const circuits = options.circuits ?? [...local.keys()].sort();
  const missing = circuits.filter((c) => !local.has(c));
  if (missing.length > 0) {
    throw new Error(`No local verifier key for ${missing.join(', ')} in ${outDir}/keys`);
  }

  const onChain = await readOnChainContract(ctx.publicDataProvider, contractAddress);
  const index = signerIndex(onChain, signingKey);
  const before = statuses(onChain, local, circuits);
  logger.info({ era: onChain.era, counter: onChain.counter.toString(), before }, 'On-chain verifier keys');

  const { updates, updated, skipped } = planUpdates(mode, before, local);
  const result: RotateVerifierKeysResult = {
    contractAddress,
    mode,
    stateEra: onChain.era,
    before,
    updated,
    skipped,
    dryRun,
  };
  if (updates.length === 0) {
    logger.info('Nothing to update');
    return result;
  }

  const unsigned = new MaintenanceUpdate(contractAddress, updates, onChain.counter);
  const signed = unsigned.addSignature(index, signData(signingKey, unsigned.dataToSign));
  const ttl = new Date(Date.now() + DEFAULT_TX_TTL_SECONDS * 1000);
  const intent = Intent.new(ttl).addMaintenanceUpdate(signed);
  const unprovenTx = LedgerTransaction.seal(
    'v9',
    'Unproven',
    Transaction.fromParts(ctx.config.network.networkId, undefined, undefined, intent)
  );
  const providers = buildProviders(ctx, outDir);

  if (dryRun) {
    logger.info(`Proving and balancing the ${mode} update for ${updated.join(', ')}...`);
    const proven = await providers.proofProvider.proveTx(unprovenTx);
    await providers.walletProvider.balanceTx(proven);
    logger.info('[DRY RUN] Maintenance transaction proved and balanced; not submitted');
    return result;
  }

  logger.info(`Submitting the ${mode} update for ${updated.join(', ')}...`);
  const finalized = await submitTx(providers, { unprovenTx });
  if (finalized.status !== SucceedEntirely) {
    throw new Error(`Maintenance transaction ${finalized.txHash} finished with status ${finalized.status}`);
  }

  const afterRead = await readOnChainContract(ctx.publicDataProvider, contractAddress);
  return {
    ...result,
    txHash: finalized.txHash,
    after: statuses(afterRead, local, circuits),
  };
}
