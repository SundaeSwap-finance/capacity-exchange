import * as fs from 'fs';
import * as path from 'path';
import { extractChainSnapshotFromFacade, type ChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

const KINDS = ['shielded', 'dust', 'unshielded'] as const;

function snapshotPath(networkId: string, snapshotDir: string, kind: (typeof KINDS)[number]): string {
  return path.join(snapshotDir, `${networkId}-${kind}.json`);
}

/** Loads a chain snapshot from `${snapshotDir}/${networkId}-{shielded,dust,unshielded}.json`.
 *  Returns undefined if any of the three files are missing or unreadable/malformed. */
export function loadChainSnapshot(networkId: string, snapshotDir: string): ChainSnapshot | undefined {
  const paths = KINDS.map((k) => snapshotPath(networkId, snapshotDir, k));
  if (paths.some((p) => !fs.existsSync(p))) {
    return undefined;
  }
  try {
    const [shielded, dust, unshielded] = paths.map((p) => JSON.parse(fs.readFileSync(p, 'utf-8')));
    return { shielded, dust, unshielded };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err : String(err), snapshotDir, networkId },
      'Chain snapshot unreadable or malformed; ignoring cached snapshot'
    );
    return undefined;
  }
}

/** Writes a chain snapshot to `${snapshotDir}/${networkId}-{shielded,dust,unshielded}.json`.
 *  Each file is written atomically via a temp file + rename to prevent partial-write corruption. */
export function writeChainSnapshot(networkId: string, snapshotDir: string, snapshot: ChainSnapshot): void {
  fs.mkdirSync(snapshotDir, { recursive: true });
  for (const kind of KINDS) {
    const target = snapshotPath(networkId, snapshotDir, kind);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot[kind]));
    fs.renameSync(tmp, target);
  }
}

/** Extracts a chain snapshot from a live WalletFacade and writes it to disk. */
export async function exportChainSnapshot(
  facade: WalletFacade,
  networkId: string,
  snapshotDir: string
): Promise<ChainSnapshot> {
  const snapshot = await extractChainSnapshotFromFacade(facade);
  writeChainSnapshot(networkId, snapshotDir, snapshot);
  return snapshot;
}
