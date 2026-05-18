#!/usr/bin/env bun
/**
 * Starts N CES servers for local multi-server testing.
 *
 * Usage: MIDNIGHT_NETWORK=preview bun scripts/run-servers.ts [N]
 *
 * N defaults to 2 (minimum)
 *   - Server 1: no-dust wallet; peers to all funded servers (2..N)
 *   - Servers 2..N: hold DUST and serve it directly.
 *
 * Ports:
 *   - Server i API:       BASE_PORT + i - 1       (default base: 3000)
 *   - Server i dashboard: BASE_DASHBOARD_PORT + i - 1  (default base: 4000)
 *
 * Wallet files (resolved relative to the repo root):
 *   - Server 1: SERVER1_WALLET_MNEMONIC_FILE env var, or
 *               wallet-mnemonic-no-dust.<MIDNIGHT_NETWORK>.txt  — must have shielded balance, no DUST.
 *   - Server i: wallet-mnemonic-{i}.<MIDNIGHT_NETWORK>.txt      — must have DUST balance.
 *   Set SKIP_BALANCE_CHECK=1 to bypass all balance checks.
 *
 * Files of Servers 2..N:
 *   - price-config-{i}.<MIDNIGHT_NETWORK>.json   (copied from the default config if absent)
 *   - .quote-secret-{i}.hex                      (auto-created by the server on first run)
 *
 * Optional env vars:
 *   - CHAIN_SNAPSHOT_DIR  Path to a chain snapshot directory. When set, balance
 *                         checks sync from the snapshot offset instead of genesis.
 *   - LOG_DIR             Directory for server log files (default: apps/server/).
 */

import { existsSync, readFileSync, copyFileSync, openSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseMnemonic } from '@sundaeswap/capacity-exchange-core';
import {
  createWalletContext,
  loadChainSnapshot,
  buildNetworkConfig,
  resolveEnv,
} from '@sundaeswap/capacity-exchange-nodejs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const N = parseInt(process.argv[2] ?? '2', 10);
if (isNaN(N) || N < 2) {
  console.error('Error: N must be at least 2 (1 no-dust + at least 1 funded server)');
  process.exit(1);
}

const BASE_PORT = parseInt(process.env.BASE_PORT ?? '3000', 10);
const BASE_DASHBOARD_PORT = parseInt(process.env.BASE_DASHBOARD_PORT ?? '4000', 10);
const LOG_DIR = process.env.LOG_DIR ?? PROJECT_ROOT;
const MIDNIGHT_NETWORK = process.env.MIDNIGHT_NETWORK ?? 'preview';
const SKIP_BALANCE_CHECK = process.env.SKIP_BALANCE_CHECK === '1';
const CHAIN_SNAPSHOT_DIR = process.env.CHAIN_SNAPSHOT_DIR;
const WALLET_STATE_DIR = process.env.WALLET_STATE_DIR ?? join(PROJECT_ROOT, '.wallet-state');

const SERVER1_WALLET_MNEMONIC_FILE =
  process.env.SERVER1_WALLET_MNEMONIC_FILE ??
  resolve(PROJECT_ROOT, '..', '..', `wallet-mnemonic-no-dust.${MIDNIGHT_NETWORK}.txt`);

/** Returns the mnemonic file path for funded server `i` (where i > 1). */
function serverMnemonicFile(i: number): string {
  return resolve(PROJECT_ROOT, '..', '..', `wallet-mnemonic-${i}.${MIDNIGHT_NETWORK}.txt`);
}

/** Clones the current process environment, filtering out undefined values for Bun.spawn. */
function baseEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
}

/**
 * Syncs a wallet from the given mnemonic file and returns its synced state.
 * Uses the on-disk state from WALLET_STATE_DIR so repeated runs resume from
 * the last known offset rather than re-syncing from scratch. Falls back to
 * an in-memory sync primed from CHAIN_SNAPSHOT_DIR if WALLET_STATE_DIR is unset.
 */
async function getBalances(mnemonicFile: string) {
  const mnemonic = readFileSync(mnemonicFile, 'utf-8').trim();
  const stateSource = WALLET_STATE_DIR
    ? { kind: 'onDisk' as const, walletStateDir: WALLET_STATE_DIR }
    : {
        kind: 'inMemory' as const,
        chainSnapshot: CHAIN_SNAPSHOT_DIR
          ? loadChainSnapshot(MIDNIGHT_NETWORK, CHAIN_SNAPSHOT_DIR)
          : undefined,
      };
  const { walletFacade } = await createWalletContext({
    network: buildNetworkConfig(MIDNIGHT_NETWORK, resolveEnv()),
    wallet: {
      seed: parseMnemonic(mnemonic),
      stateSource,
      walletSyncTimeoutMs: 3_600_000,
    },
  });
  return walletFacade.waitForSyncedState();
}

// ── Require server 1 wallet mnemonic ─────────────────────────────────────────
if (!existsSync(SERVER1_WALLET_MNEMONIC_FILE)) {
  console.error(`Error: Server 1 wallet mnemonic not found at ${SERVER1_WALLET_MNEMONIC_FILE}`);
  process.exit(1);
}

// ── Validate per-server wallets and price configs ─────────────────────────────
const DEFAULT_PRICE_CONFIG = join(PROJECT_ROOT, `price-config.${MIDNIGHT_NETWORK}.json`);

for (let i = 2; i <= N; i++) {
  const mnemonicFileI = serverMnemonicFile(i);
  if (!existsSync(mnemonicFileI)) {
    console.error(`Error: Server ${i} wallet mnemonic not found at ${mnemonicFileI}`);
    process.exit(1);
  }

  const priceConfigI = join(PROJECT_ROOT, `price-config-${i}.${MIDNIGHT_NETWORK}.json`);
  if (!existsSync(priceConfigI)) {
    if (!existsSync(DEFAULT_PRICE_CONFIG)) {
      console.error(
        `Error: Cannot create ${priceConfigI} — default config not found at ${DEFAULT_PRICE_CONFIG}`,
      );
      process.exit(1);
    }
    copyFileSync(DEFAULT_PRICE_CONFIG, priceConfigI);
    console.log(`Created ${priceConfigI} from ${DEFAULT_PRICE_CONFIG}`);
  }
}

// ── Balance checks ────────────────────────────────────────────────────────────
if (!SKIP_BALANCE_CHECK) {
  // TODO: should we add restriction for mainnet?
  // if (MIDNIGHT_NETWORK === 'mainnet') {
  //   console.error('Error: This script is for testing purposes; does not support MIDNIGHT_NETWORK=mainnet.');
  //   process.exit(1);
  // }

  // Server 1: sync once, check both shielded (must have) and dust (must not have)
  console.log(
    `Checking server 1 shielded balance on '${MIDNIGHT_NETWORK}' (this may take a moment)...`,
  );

  const server1State = await getBalances(SERVER1_WALLET_MNEMONIC_FILE);

  for (const [tokenId, amount] of Object.entries(
    server1State.shielded.balances as Record<string, bigint>,
  )) {
    console.log(`  shielded [${tokenId}]: ${amount}`);
  }

  // True if the wallet holds the accepted payment token with a non-zero shielded balance.
  const hasShielded = Object.values(server1State.shielded.balances as Record<string, bigint>).some(
    (v) => v > 0n,
  );

  console.log('Checking server 1 has shielded balance:' + (hasShielded ? 'OK' : 'MISSING'));

  if (!hasShielded) {
    console.error('');
    console.error('Error: Server 1 wallet has no shielded balance.');
    process.exit(1);
  }

  console.log(
    'Checking server 1 has no DUST balance (it should rely on peer CES servers for dust)...',
  );
  const server1Dust = server1State.dust.balance(new Date()) as bigint;
  if (server1Dust > 0n) {
    console.error('');
    console.error('Warning: Server 1 wallet has a DUST balance.');
    console.error('Server 1 is intended to be a no-dust wallet.');
    console.error('Using a wallet with existing dust may cause unexpected behaviour.');
    process.exit(1);
  }

  // Servers 2..N: must have dust
  for (let i = 2; i <= N; i++) {
    const mnemonicFileI = serverMnemonicFile(i);
    console.log(
      `Checking server ${i} DUST balance on '${MIDNIGHT_NETWORK}' (this may take a moment)...`,
    );
    const stateI = await getBalances(mnemonicFileI);
    const dustI = stateI.dust.balance(new Date()) as bigint;

    if (dustI === 0n) {
      console.error('');
      console.error(`Error: Server ${i} wallet has no DUST balance.`);

      // Need to register unshielded NIGHT UTxOs for dust generation.
      // Check cd packages/midnight-node bun src/cli/balances.ts ${MIDNIGHT_NETWORK} --register-dust`
      process.exit(1);
    }
  }
}

// ── Cleanup handler ───────────────────────────────────────────────────────────
const procs: { proc: ReturnType<typeof Bun.spawn>; num: number }[] = [];

function cleanup() {
  console.log('\nStopping servers...');
  for (const { proc, num } of procs) {
    try {
      proc.kill();
      console.log(`Server ${num} (PID ${proc.pid}) stopped`);
    } catch {
      // already exited
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// ── Build peer URL list for server 1 (all funded servers) ────────────────────
const peerUrls = Array.from(
  { length: N - 1 },
  (_, idx) => `http://localhost:${BASE_PORT + idx + 1}`,
).join(',');

// ── Start server 1 (no dust — peers to all funded servers) ───────────────────
const server1Port = BASE_PORT;
console.log(`Starting server 1 on port ${server1Port} (no-dust wallet, peers -> ${peerUrls})...`);

// updating environment variables for server 1 (no-dust wallet)
const env1 = baseEnv();
env1.PORT = String(server1Port);
env1.DASHBOARD_PORT = String(BASE_DASHBOARD_PORT);
env1.MIDNIGHT_NETWORK = MIDNIGHT_NETWORK;
env1.WALLET_MNEMONIC_FILE = SERVER1_WALLET_MNEMONIC_FILE;
env1.PRICE_CONFIG_FILE = DEFAULT_PRICE_CONFIG;
env1.CAPACITY_EXCHANGE_PEER_URLS = peerUrls;
delete env1.WALLET_SEED_FILE;

const server1LogPath = join(LOG_DIR, 'server1.log');
const server1LogFd = openSync(server1LogPath, 'a');
const server1Proc = Bun.spawn(['bun', join(PROJECT_ROOT, 'src/server.ts')], {
  env: env1,
  stdout: server1LogFd,
  stderr: server1LogFd,
});
procs.push({ proc: server1Proc, num: 1 });
console.log(`Server 1 started (PID ${server1Proc.pid}) — logs: ${server1LogPath}`);

// ── Start funded servers 2..N ─────────────────────────────────────────────────
for (let i = 2; i <= N; i++) {
  const portI = BASE_PORT + i - 1;
  const mnemonicFileI = serverMnemonicFile(i);
  console.log(
    `Starting server ${i} on port ${portI} (funded wallet, mnemonic: ${mnemonicFileI})...`,
  );

  const envI = baseEnv();
  envI.PORT = String(portI);
  envI.DASHBOARD_PORT = String(BASE_DASHBOARD_PORT + i - 1);
  envI.MIDNIGHT_NETWORK = MIDNIGHT_NETWORK;
  envI.WALLET_MNEMONIC_FILE = mnemonicFileI;
  envI.PRICE_CONFIG_FILE = join(PROJECT_ROOT, `price-config-${i}.${MIDNIGHT_NETWORK}.json`);
  envI.QUOTE_SECRET_FILE = join(PROJECT_ROOT, `.quote-secret-${i}.hex`);
  delete envI.WALLET_SEED_FILE;
  delete envI.CAPACITY_EXCHANGE_PEER_URLS;

  const logPathI = join(LOG_DIR, `server${i}.log`);
  const logFdI = openSync(logPathI, 'a');
  const procI = Bun.spawn(['bun', join(PROJECT_ROOT, 'src/server.ts')], {
    env: envI,
    stdout: logFdI,
    stderr: logFdI,
  });
  procs.push({ proc: procI, num: i });
  console.log(`Server ${i} started (PID ${procI.pid}) — logs: ${logPathI}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`${N} servers running. Press Ctrl+C to stop.`);
console.log(
  `  Server 1: http://localhost:${BASE_PORT}  (no dust, peers -> ${peerUrls})  dashboard: ${BASE_DASHBOARD_PORT}`,
);
for (let i = 2; i <= N; i++) {
  console.log(
    `  Server ${i}: http://localhost:${BASE_PORT + i - 1}  (funded wallet)  dashboard: ${BASE_DASHBOARD_PORT + i - 1}`,
  );
}

await Promise.all(procs.map(({ proc }) => proc.exited));
