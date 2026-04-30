#!/usr/bin/env bun
/**
 * Syncs a throwaway wallet on each network and extracts the chain state
 * into snapshot files at `--out-dir`. Used by demo webapp + CI smoke
 * tests to skip syncing from genesis. By default, if `--out-dir` already
 * contains a snapshot, resumes from it. Pass `--force-fresh` to ignore
 * the existing snapshot and sync from genesis (overwrites on success).
 *
 * Usage:
 *   bun scripts/update-wallet-snapshots.ts --out-dir <path> [--force-fresh] [network...]
 *
 * Examples:
 *   bun scripts/update-wallet-snapshots.ts --out-dir apps/demo/public/wallet-snapshots
 *   bun scripts/update-wallet-snapshots.ts --out-dir .chain-snapshots preview
 *   bun scripts/update-wallet-snapshots.ts --out-dir .chain-snapshots --force-fresh preview
 */

import * as path from 'path';
import {
  withAppContext,
  buildNetworkConfig,
  resolveEnv,
  loadChainSnapshot,
  exportChainSnapshot,
  type AppConfig,
} from '@sundaeswap/capacity-exchange-nodejs';
import { generateMnemonic, parseMnemonic, type ChainSnapshot } from '@sundaeswap/capacity-exchange-core';

const WALLET_SYNC_TIMEOUT_MS = 1500000; // 25 minutes — first run syncs from genesis
const NETWORKS = ['preview', 'preprod', 'mainnet'];

function resolveStartingSnapshot(
  networkId: string,
  outDir: string,
  forceFresh: boolean
): { chainSnapshot: ChainSnapshot | undefined; reason: string } {
  if (forceFresh) {
    return { chainSnapshot: undefined, reason: '--force-fresh set; syncing from genesis' };
  }
  const cached = loadChainSnapshot(networkId, outDir);
  if (cached) {
    return { chainSnapshot: cached, reason: 'Resuming from cached snapshot' };
  }
  return { chainSnapshot: undefined, reason: 'No cached snapshot — syncing from genesis' };
}

async function updateSnapshot(networkId: string, outDir: string, forceFresh: boolean): Promise<void> {
  const env = resolveEnv();
  const network = buildNetworkConfig(networkId, env);
  const { chainSnapshot, reason } = resolveStartingSnapshot(networkId, outDir, forceFresh);
  console.log(`[${networkId}] ${reason}`);

  const config: AppConfig = {
    network,
    wallet: {
      seed: parseMnemonic(generateMnemonic()),
      stateSource: { kind: 'inMemory', chainSnapshot },
      walletSyncTimeoutMs: WALLET_SYNC_TIMEOUT_MS,
    },
  };

  const start = Date.now();
  await withAppContext(config, async (ctx) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${networkId}] Synced in ${elapsed}s, exporting...`);
    const snapshot = await exportChainSnapshot(ctx.walletContext.walletFacade, networkId, outDir);
    console.log(`[${networkId}] Saved snapshot at offset ${snapshot.shielded.offset} → ${outDir}`);
  });
}

const argv = process.argv.slice(2);
let outDirArg: string | undefined;
let forceFresh = false;
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out-dir') {
    outDirArg = argv[++i];
  } else if (argv[i] === '--force-fresh') {
    forceFresh = true;
  } else {
    positional.push(argv[i]);
  }
}

const usage = `Usage: bun scripts/update-wallet-snapshots.ts --out-dir <path> [--force-fresh] [${NETWORKS.join('|')}]`;

if (!outDirArg) {
  console.error(usage);
  process.exit(1);
}
const outDir = path.resolve(outDirArg);

const networks = positional.length > 0 ? positional.filter((n) => NETWORKS.includes(n)) : [...NETWORKS];

if (networks.length === 0) {
  console.error(usage);
  process.exit(1);
}

const failures: string[] = [];
for (const network of networks) {
  try {
    await updateSnapshot(network, outDir, forceFresh);
  } catch (err) {
    console.error(`[${network}] Failed:`, err);
    failures.push(network);
  }
}

if (failures.length > 0) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Done');
process.exit(0);
