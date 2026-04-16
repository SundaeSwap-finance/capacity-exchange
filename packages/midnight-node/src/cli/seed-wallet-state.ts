import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { deriveWalletKeys, toNetworkIdEnum, type WalletKeys } from '@sundaeswap/capacity-exchange-core';
import { PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { loadWalletSeed } from '../walletFile.js';
import { createLogger } from '../createLogger.js';

const logger = createLogger(import.meta);

interface ShieldedSnap {
  state: string;
  offset: number;
  protocolVersion: number;
}

interface DustSnap {
  state: string;
  offset: number;
  protocolVersion: number;
}

interface UnshieldedSnap {
  appliedId: number;
  protocolVersion: number;
}

/** Builds synthetic wallet state from chain snapshots + wallet keys, with empty balances. */
function buildSyntheticState(
  shieldedSnap: ShieldedSnap,
  dustSnap: DustSnap,
  unshieldedSnap: UnshieldedSnap,
  keys: WalletKeys,
  networkId: string
) {
  const unshieldedPub = PublicKey.fromKeyStore(keys.unshieldedKeystore);
  return {
    shielded: JSON.stringify({
      publicKeys: {
        coinPublicKey: keys.shieldedSecretKeys.coinPublicKey,
        encryptionPublicKey: keys.shieldedSecretKeys.encryptionPublicKey,
      },
      state: shieldedSnap.state,
      protocolVersion: shieldedSnap.protocolVersion,
      offset: shieldedSnap.offset,
      networkId,
      coinHashes: {},
    }),
    dust: JSON.stringify({
      publicKey: { publicKey: keys.dustSecretKey.publicKey.toString() },
      state: dustSnap.state,
      protocolVersion: dustSnap.protocolVersion,
      networkId,
      offset: dustSnap.offset,
    }),
    unshielded: JSON.stringify({
      publicKey: {
        publicKey: unshieldedPub.publicKey,
        addressHex: unshieldedPub.addressHex,
        address: unshieldedPub.address,
      },
      state: { availableUtxos: [], pendingUtxos: [] },
      protocolVersion: unshieldedSnap.protocolVersion,
      appliedId: unshieldedSnap.appliedId,
      networkId,
    }),
  };
}

/** Seeds a wallet state directory with chain snapshots so withAppContext syncs from the snapshot offset,
 * not genesis. */
function main() {
  program
    .name('seed-wallet-state')
    .description('Write synthetic wallet state from chain snapshots to skip syncing from genesis')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument('<stateDir>', 'Wallet state directory to write to')
    .argument('<snapshotDir>', 'Directory containing chain snapshot files')
    .parse();

  const [networkId, stateDir, snapshotDir] = program.args;
  const networkIdEnum = toNetworkIdEnum(networkId);
  const seed = loadWalletSeed(networkId);
  const seedHex = Array.from(seed)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const keys = deriveWalletKeys(seedHex, networkIdEnum);
  const coinPubKey = keys.shieldedSecretKeys.coinPublicKey;
  const prefix = `${networkIdEnum}-${coinPubKey}`;

  const snapshotFiles = ['shielded', 'dust', 'unshielded'].map((k) => path.join(snapshotDir, `${networkId}-${k}.json`));
  if (snapshotFiles.some((f) => !fs.existsSync(f))) {
    logger.info(`Incomplete or missing snapshots in ${snapshotDir} — skipping (wallet will sync from genesis)`);
    return;
  }

  const [shieldedSnap, dustSnap, unshieldedSnap] = snapshotFiles.map((f) => JSON.parse(fs.readFileSync(f, 'utf-8')));

  const saved = buildSyntheticState(
    shieldedSnap as ShieldedSnap,
    dustSnap as DustSnap,
    unshieldedSnap as UnshieldedSnap,
    keys,
    String(networkIdEnum)
  );

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `${prefix}-shielded.data`), saved.shielded);
  fs.writeFileSync(path.join(stateDir, `${prefix}-dust.data`), saved.dust);
  fs.writeFileSync(path.join(stateDir, `${prefix}-unshielded.data`), saved.unshielded);

  logger.info(`Seeded wallet state in ${stateDir} at shielded offset ${(shieldedSnap as ShieldedSnap).offset}`);
}

main();
