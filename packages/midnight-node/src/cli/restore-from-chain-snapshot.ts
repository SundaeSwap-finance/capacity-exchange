import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { deriveWalletKeys, toNetworkIdEnum, buildSyntheticWalletState } from '@sundaeswap/capacity-exchange-core';
import { loadSeedFromFile, loadMnemonicFromFile } from '../walletFile.js';
import { loadChainSnapshot } from '../chainSnapshot.js';
import { createLogger } from '../createLogger.js';

const logger = createLogger(import.meta);

/** Restores wallet state files for the given wallet from a chain snapshot so
 * withAppContext syncs from the snapshot offset, not genesis. */
async function main() {
  program
    .name('restore-from-chain-snapshot')
    .description('Restore wallet state from a chain snapshot to skip syncing from genesis')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument('<stateDir>', 'Wallet state directory to write to')
    .argument('<snapshotDir>', 'Directory containing chain snapshot files')
    .option('--seed-file <path>', 'Path to hex-encoded wallet seed file')
    .option('--mnemonic-file <path>', 'Path to wallet mnemonic file')
    .parse();

  const [networkId, stateDir, snapshotDir] = program.args;
  const opts = program.opts<{ seedFile?: string; mnemonicFile?: string }>();
  const hasSeed = !!opts.seedFile;
  const hasMnemonic = !!opts.mnemonicFile;
  if (hasSeed === hasMnemonic) {
    throw new Error('Specify exactly one of --seed-file or --mnemonic-file');
  }
  const networkIdEnum = toNetworkIdEnum(networkId);
  const seed = hasSeed ? loadSeedFromFile(opts.seedFile!) : loadMnemonicFromFile(opts.mnemonicFile!);
  const seedHex = Array.from(seed)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const keys = deriveWalletKeys(seedHex, networkIdEnum);
  const coinPubKey = keys.shieldedSecretKeys.coinPublicKey;
  const prefix = `${networkIdEnum}-${coinPubKey}`;

  const snapshot = loadChainSnapshot(networkId, snapshotDir);
  if (!snapshot) {
    logger.info(`Incomplete or missing snapshots in ${snapshotDir} — skipping (wallet will sync from genesis)`);
    return;
  }

  const saved = buildSyntheticWalletState(snapshot, keys, String(networkIdEnum));

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, `${prefix}-shielded.data`), saved.savedShieldedState!);
  fs.writeFileSync(path.join(stateDir, `${prefix}-dust.data`), saved.savedDustState!);
  fs.writeFileSync(path.join(stateDir, `${prefix}-unshielded.data`), saved.savedUnshieldedState!);

  logger.info(
    `Restored wallet state files for ${prefix} in ${stateDir} from chain snapshot at shielded offset ${snapshot.shielded.offset}`
  );
}

main();
