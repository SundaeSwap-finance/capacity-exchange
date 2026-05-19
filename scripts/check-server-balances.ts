#!/usr/bin/env bun
/**
 * Checks wallet balances for N CES servers before starting them.
 *
 * - Server 1 (no-dust): must have shielded balance, must NOT have DUST.
 * - Servers 2..N (funded): must have DUST balance.
 *
 * Usage:
 *   bun scripts/check-server-balances.ts \
 *     --network <network> \
 *     --server1-mnemonic <file> | --server1-seed <file> \
 *     --wallet-state-dir <dir> \
 *     --chain-snapshot-dir <dir> \
 *     [--mnemonic <file> | --seed <file>]...
 */

import { withAppContext, buildAppConfig, resolveEnv } from '@sundaeswap/capacity-exchange-nodejs';

// ── Arg parsing ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

let network = '';
let server1File = '';
let server1IsSeed = false;
let walletStateDir = '';
const fundedWallets: { file: string; isSeed: boolean }[] = [];

for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case '--network':
      network = argv[++i];
      break;
    case '--server1-mnemonic':
      server1File = argv[++i];
      server1IsSeed = false;
      break;
    case '--server1-seed':
      server1File = argv[++i];
      server1IsSeed = true;
      break;
    case '--wallet-state-dir':
      walletStateDir = argv[++i];
      break;
    case '--chain-snapshot-dir':
      ++i;
      break; // accepted but unused — onDisk state handles its own offset
    case '--mnemonic':
      fundedWallets.push({ file: argv[++i], isSeed: false });
      break;
    case '--seed':
      fundedWallets.push({ file: argv[++i], isSeed: true });
      break;
  }
}

if (!network || !server1File || !walletStateDir) {
  console.error(
    'Usage: check-server-balances.ts --network <n> --server1-mnemonic|--server1-seed <file> --wallet-state-dir <dir> [--mnemonic|--seed <file>]...'
  );
  process.exit(1);
}

// ── Wallet sync ───────────────────────────────────────────────────────────────

async function syncWallet(file: string, isSeed: boolean) {
  const walletEnvKey = isSeed ? 'WALLET_SEED_FILE' : 'WALLET_MNEMONIC_FILE';
  const env = { ...resolveEnv(), [walletEnvKey]: file, WALLET_STATE_DIR: walletStateDir };
  const config = buildAppConfig(network, env);
  return withAppContext(config, (ctx) => ctx.walletContext.walletFacade.waitForSyncedState());
}

// ── Checks ────────────────────────────────────────────────────────────────────

console.log(`Checking server 1 balances on '${network}' (this may take a moment)...`);
const server1State = await syncWallet(server1File, server1IsSeed);

const hasShielded = Object.values(server1State.shielded.balances as Record<string, bigint>).some((v) => v > 0n);
if (!hasShielded) {
  console.error('ERROR: Server 1 wallet has no shielded balance.');
  process.exit(1);
}
console.log('Server 1 shielded balance: OK');

const server1Dust = server1State.dust.balance(new Date()) as bigint;
if (server1Dust > 0n) {
  console.error('ERROR: Server 1 wallet has a DUST balance — it must be a no-dust wallet.');
  process.exit(1);
}
console.log('Server 1 DUST balance: OK (none)');

for (let i = 0; i < fundedWallets.length; i++) {
  const serverNum = i + 2;
  const { file, isSeed } = fundedWallets[i];
  console.log(`Checking server ${serverNum} DUST balance on '${network}' (this may take a moment)...`);
  const state = await syncWallet(file, isSeed);
  const dust = state.dust.balance(new Date()) as bigint;
  if (dust === 0n) {
    console.error(`ERROR: Server ${serverNum} wallet has no DUST balance.`);
    process.exit(1);
  }
  console.log(`Server ${serverNum} DUST balance: OK (${dust})`);
}

console.log('All balance checks passed.');
process.exit(0);
