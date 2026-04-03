/**
 * Shared scaffolding for wallet balance check scripts.
 * Syncs a wallet from a mnemonic file, runs a check against the synced state,
 * then cleans up the temporary wallet state directory.
 */
import { createWalletFromMnemonic } from '@capacity-exchange/midnight-core';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileStateStore } from '@capacity-exchange/midnight-node';
import pino from 'pino';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';

export type { FacadeState };

/**
 * Syncs the wallet at `mnemonicFile` on `network`, then calls `check` with
 * the synced state. Cleans up the temp state dir when done.
 *
 * Exit codes are the caller's responsibility — `check` should call `process.exit`.
 */
export async function withWalletState(
  scriptName: string,
  mnemonicFile: string | undefined,
  network: string | undefined,
  check: (state: FacadeState) => void,
): Promise<void> {
  if (!mnemonicFile || !network) {
    console.error(`Usage: ${scriptName} <mnemonic-file> <network>`);
    process.exit(2);
  }

  const logger = pino({ level: 'silent' });
  const tmpDir = mkdtempSync(join(tmpdir(), 'ces-balance-check-'));

  try {
    const mnemonic = readFileSync(mnemonicFile, 'utf-8').trim();
    const store = new FileStateStore(tmpDir, logger);

    const connection = await createWalletFromMnemonic(
      { mnemonic, networkId: network, syncTimeoutMs: 120_000 },
      store,
    );

    const state = await connection.walletFacade.waitForSyncedState();
    check(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Balance check failed: ${msg}`);
    process.exit(2);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}