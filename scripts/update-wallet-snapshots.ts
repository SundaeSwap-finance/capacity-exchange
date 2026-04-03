#!/usr/bin/env bun
/**
 * Syncs a throwaway wallet on each network and extracts the chain state
 * into snapshot files used by the demo webapp to skip syncing from genesis.
 *
 * Usage:
 *   bun scripts/update-wallet-snapshots.ts [network...]
 *
 * Examples:
 *   bun scripts/update-wallet-snapshots.ts              # all networks
 *   bun scripts/update-wallet-snapshots.ts preview      # just preview
 *   bun scripts/update-wallet-snapshots.ts preview preprod
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  deriveWalletKeys,
  resolveEndpoints,
  toNetworkIdEnum,
  COST_PARAMS,
  createWallet,
} from '@capacity-exchange/midnight-core';

const NETWORKS = ['preview', 'preprod', 'mainnet'];
const OUT_DIR = path.resolve(import.meta.dirname, '../packages/example-webapp/public/wallet-snapshots');

async function updateSnapshot(networkId: string) {
  console.log(`[${networkId}] Syncing throwaway wallet...`);
  const start = Date.now();

  const networkIdEnum = toNetworkIdEnum(networkId);
  const endpoints = resolveEndpoints(networkIdEnum);

  // Generate a random seed — we only care about the chain state, not the keys
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  const seedHex = Array.from(seedBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const walletConfig = {
    networkId: networkIdEnum,
    costParameters: COST_PARAMS,
    relayURL: new URL(endpoints.nodeUrl),
    provingServerUrl: new URL(endpoints.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: endpoints.indexerHttpUrl,
      indexerWsUrl: endpoints.indexerWsUrl,
    },
  };

  const keys = deriveWalletKeys(seedHex, networkIdEnum);
  const connection = await createWallet({ seedHex, walletConfig });
  const { walletFacade } = connection;

  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);

  // Wait for shielded + dust only
  await Promise.all([
    walletFacade.shielded.waitForSyncedState(),
    walletFacade.dust.waitForSyncedState(),
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${networkId}] Synced in ${elapsed}s, serializing...`);

  const [shieldedSerialized, dustSerialized] = await Promise.all([
    walletFacade.shielded.serializeState(),
    walletFacade.dust.serializeState(),
  ]);

  const shielded = JSON.parse(shieldedSerialized);
  const dust = JSON.parse(dustSerialized);

  // Extract chain-only state (no wallet-specific keys or coins)
  const shieldedSnapshot = {
    state: shielded.state,
    offset: shielded.offset,
    protocolVersion: shielded.protocolVersion,
  };

  const dustSnapshot = {
    state: dust.state,
    offset: dust.offset,
    protocolVersion: dust.protocolVersion,
  };

  // Unshielded just needs the appliedId for the offset
  const unshieldedSnapshot = {
    appliedId: shielded.offset, // approximate — close enough
    protocolVersion: shielded.protocolVersion,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${networkId}-shielded.json`), JSON.stringify(shieldedSnapshot));
  fs.writeFileSync(path.join(OUT_DIR, `${networkId}-dust.json`), JSON.stringify(dustSnapshot));
  fs.writeFileSync(path.join(OUT_DIR, `${networkId}-unshielded.json`), JSON.stringify(unshieldedSnapshot));

  const totalKB = (
    JSON.stringify(shieldedSnapshot).length +
    JSON.stringify(dustSnapshot).length +
    JSON.stringify(unshieldedSnapshot).length
  ) / 1024;

  console.log(`[${networkId}] Saved snapshots (${totalKB.toFixed(0)}KB total) at offset ${shielded.offset}`);
}

const requested = process.argv.slice(2);
const networks = requested.length > 0
  ? requested.filter(n => NETWORKS.includes(n))
  : [...NETWORKS];

if (networks.length === 0) {
  console.error(`Usage: bun scripts/update-wallet-snapshots.ts [${NETWORKS.join('|')}]`);
  process.exit(1);
}

for (const network of networks) {
  try {
    await updateSnapshot(network);
  } catch (err) {
    console.error(`[${network}] Failed:`, err);
  }
}

console.log('Done');
process.exit(0);
