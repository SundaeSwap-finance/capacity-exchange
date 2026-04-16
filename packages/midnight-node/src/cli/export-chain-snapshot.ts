import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../createLogger.js';

/**
 * Extracts chain-state-only snapshots from a wallet state directory.
 * These snapshots can be used by seed-wallet-state to bootstrap new wallets.
 */

const logger = createLogger(import.meta);

function main() {
  program
    .name('export-chain-snapshot')
    .description('Extract chain state from wallet state files into snapshot files')
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

  const shielded = JSON.parse(fs.readFileSync(path.join(stateDir, shieldedFile), 'utf-8'));
  const dust = JSON.parse(fs.readFileSync(path.join(stateDir, dustFile), 'utf-8'));
  const unshielded = JSON.parse(fs.readFileSync(path.join(stateDir, unshieldedFile), 'utf-8'));

  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotDir, `${networkId}-shielded.json`),
    JSON.stringify({ state: shielded.state, offset: shielded.offset, protocolVersion: shielded.protocolVersion })
  );
  fs.writeFileSync(
    path.join(snapshotDir, `${networkId}-dust.json`),
    JSON.stringify({ state: dust.state, offset: dust.offset, protocolVersion: dust.protocolVersion })
  );
  fs.writeFileSync(
    path.join(snapshotDir, `${networkId}-unshielded.json`),
    JSON.stringify({ appliedId: unshielded.appliedId, protocolVersion: unshielded.protocolVersion })
  );

  logger.info(`Exported chain snapshot to ${snapshotDir} at offset ${shielded.offset}`);
}

main();
