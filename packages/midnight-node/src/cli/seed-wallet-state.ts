import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveWalletKeys,
  toNetworkIdEnum,
  buildSyntheticWalletState,
  type ChainSnapshot,
} from '@sundaeswap/capacity-exchange-core';
import { loadWalletSeed } from '../walletFile.js';
import { createLogger } from '../createLogger.js';

const logger = createLogger(import.meta);

/** Seeds a wallet state directory with chain snapshots so withAppContext syncs
 * from the snapshot offset, not genesis. */
async function main() {
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

  // Load chain snapshots
  const snapshotFiles = ['shielded', 'dust', 'unshielded'].map((k) => path.join(snapshotDir, `${networkId}-${k}.json`));
  if (snapshotFiles.some((f) => !fs.existsSync(f))) {
    logger.info(`Incomplete or missing snapshots in ${snapshotDir} — skipping (wallet will sync from genesis)`);
    return;
  }

  const snapshot: ChainSnapshot = {
    shielded: JSON.parse(fs.readFileSync(snapshotFiles[0], 'utf-8')),
    dust: JSON.parse(fs.readFileSync(snapshotFiles[1], 'utf-8')),
    unshielded: JSON.parse(fs.readFileSync(snapshotFiles[2], 'utf-8')),
  };

  const saved = buildSyntheticWalletState(snapshot, keys, String(networkIdEnum));

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `${prefix}-shielded.data`), saved.savedShieldedState!);
  fs.writeFileSync(path.join(stateDir, `${prefix}-dust.data`), saved.savedDustState!);
  fs.writeFileSync(path.join(stateDir, `${prefix}-unshielded.data`), saved.savedUnshieldedState!);

  logger.info(`Seeded wallet state in ${stateDir} at shielded offset ${snapshot.shielded.offset}`);
}

main();
