import * as fs from 'fs';
import * as path from 'path';
import { extractChainSnapshotFromFacade, type ChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

const KINDS = ['shielded', 'dust', 'unshielded'] as const;

function snapshotPath(networkId: string, snapshotDir: string, kind: (typeof KINDS)[number]): string {
  return path.join(snapshotDir, `${networkId}-${kind}.json`);
}

/** Loads a chain snapshot from `${snapshotDir}/${networkId}-{shielded,dust,unshielded}.json`.
 *  Returns undefined if any of the three files are missing. */
export function loadChainSnapshot(networkId: string, snapshotDir: string): ChainSnapshot | undefined {
  const paths = KINDS.map((k) => snapshotPath(networkId, snapshotDir, k));
  if (paths.some((p) => !fs.existsSync(p))) {
    return undefined;
  }
  const [shielded, dust, unshielded] = paths.map((p) => JSON.parse(fs.readFileSync(p, 'utf-8')));
  return { shielded, dust, unshielded };
}

/** Writes a chain snapshot to `${snapshotDir}/${networkId}-{shielded,dust,unshielded}.json`. */
export function writeChainSnapshot(networkId: string, snapshotDir: string, snapshot: ChainSnapshot): void {
  fs.mkdirSync(snapshotDir, { recursive: true });
  for (const kind of KINDS) {
    fs.writeFileSync(snapshotPath(networkId, snapshotDir, kind), JSON.stringify(snapshot[kind]));
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
