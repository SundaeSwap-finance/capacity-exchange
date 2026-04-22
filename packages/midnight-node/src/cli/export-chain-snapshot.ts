import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { extractChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import { createLogger } from '../createLogger.js';

const logger = createLogger(import.meta);

/**
 * Exports chain-state-only snapshots from a wallet state directory.
 * These snapshots can be used by restore-from-chain-snapshot to bootstrap new wallets.
 */
function main() {
  program
    .name('export-chain-snapshot')
    .description('Export chain state from wallet state files into snapshot files')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument('<stateDir>', 'Wallet state directory to read from')
    .argument('<snapshotDir>', 'Directory to write snapshot files to')
    .parse();

  const [networkId, stateDir, snapshotDir] = program.args;

  const files = fs.readdirSync(stateDir).filter((f) => f.endsWith('.data'));
  const shieldedFile = files.find((f) => f.includes('-shielded.data'));
  const dustFile = files.find((f) => f.includes('-dust.data'));
  const unshieldedFile = files.find((f) => f.includes('-unshielded.data'));

  if (!shieldedFile || !dustFile || !unshieldedFile) {
    logger.info('No complete wallet state found — skipping snapshot export');
    return;
  }

  const snapshot = extractChainSnapshot({
    savedShieldedState: fs.readFileSync(path.join(stateDir, shieldedFile), 'utf-8'),
    savedDustState: fs.readFileSync(path.join(stateDir, dustFile), 'utf-8'),
    savedUnshieldedState: fs.readFileSync(path.join(stateDir, unshieldedFile), 'utf-8'),
  });

  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-shielded.json`), JSON.stringify(snapshot.shielded));
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-dust.json`), JSON.stringify(snapshot.dust));
  fs.writeFileSync(path.join(snapshotDir, `${networkId}-unshielded.json`), JSON.stringify(snapshot.unshielded));

  logger.info(`Exported chain snapshot to ${snapshotDir} at offset ${snapshot.shielded.offset}`);
}

main();
