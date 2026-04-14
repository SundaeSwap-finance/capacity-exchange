import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { extractChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import { createLogger } from '../createLogger.js';

/**
 * Extracts chain-state-only snapshots from a wallet state directory.
 * These snapshots can be used by seed-wallet-state to bootstrap new wallets.
 */

const logger = createLogger(import.meta);

/** Find wallet state files by scanning for known suffixes, regardless of the wallet identity prefix. */
function loadWalletStateFromDir(dir: string) {
  const files = fs.readdirSync(dir);
  const find = (suffix: string) => files.find((f) => f.endsWith(suffix));
  const shieldedFile = find('-shielded.data') ?? find('-shielded.json');
  const dustFile = find('-dust.data') ?? find('-dust.json');
  const unshieldedFile = find('-unshielded.data') ?? find('-unshielded.json');

  if (!shieldedFile || !dustFile || !unshieldedFile) {
    return null;
  }

  return {
    savedShieldedState: fs.readFileSync(path.join(dir, shieldedFile), 'utf-8'),
    savedDustState: fs.readFileSync(path.join(dir, dustFile), 'utf-8'),
    savedUnshieldedState: fs.readFileSync(path.join(dir, unshieldedFile), 'utf-8'),
  };
}

function main() {
  program
    .name('export-chain-snapshot')
    .description('Extract chain state from wallet state files into snapshot files')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument('<stateDir>', 'Wallet state directory to read from')
    .argument('<snapshotDir>', 'Directory to write snapshot files to')
    .parse();

  const [networkId, stateDir, snapshotDir] = program.args;

  const saved = loadWalletStateFromDir(stateDir);
  if (!saved) {
    logger.info('No complete wallet state found — skipping snapshot export');
    return;
  }

  const snapshot = extractChainSnapshot(saved);

  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-shielded.json`), JSON.stringify(snapshot.shielded));
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-dust.json`), JSON.stringify(snapshot.dust));
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-unshielded.json`), JSON.stringify(snapshot.unshielded));

  logger.info(`Exported chain snapshot to ${snapshotDir} at offset ${snapshot.shielded.offset}`);
}

main();
