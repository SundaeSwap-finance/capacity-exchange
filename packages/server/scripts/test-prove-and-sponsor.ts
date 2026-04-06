#!/usr/bin/env bun
/**
 * Usage: bun scripts/test-prove-and-sponsor.ts [N]
 *
 * 1. Starts N CES servers via run-servers.ts and waits for them to be ready,
 * 2. Runs the packages/example-webapp/contracts/src/counter/cli/test/prove-and-sponsor.ts 
 *    against server 1,
 * 3. Checks the test result: if result of above script HAS a tx field present:
 * 4. If success, prints the length of the tx using the bytes field,
 * 5. If failure, prints the error,
 * 6. Cleans up the servers before exiting.
 *
 * Override defaults with env vars:
 *   MIDNIGHT_NETWORK    (default: preview)
 *   BASE_PORT           (same in run--servers.ts; default: 3000)
 *   SKIP_BALANCE_CHECK  (default: 0) – passed through to run-servers.ts
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = resolve(__dirname, '..');
const CONTRACTS_DIR = resolve(SERVER_DIR, '..', 'example-webapp', 'contracts');

const N = parseInt(process.argv[2] ?? '2', 10);
const MIDNIGHT_NETWORK = process.env.MIDNIGHT_NETWORK ?? 'preview';
const BASE_PORT = parseInt(process.env.BASE_PORT ?? '3000', 10);
const SERVER_URL = `http://localhost:${BASE_PORT}`;

// Default sync timeout per server is 120, so waiting time must be at least 120*2,
// waiting on the 1st and 2nd server. Other servers can run a bit late.
// Also add 30 seconds buffer, just in case.
const READY_TIMEOUT_SECS = 240 + 30;

// ── Resolve contract address ──────────────────────────────────────────────────
const CONTRACTS_FILE = join(CONTRACTS_DIR, `.contracts.${MIDNIGHT_NETWORK}.json`);
if (!existsSync(CONTRACTS_FILE)) {
  console.error(`Error: Contracts file not found at ${CONTRACTS_FILE}`);
  // need to deploy the contracts first
  // check task deploy or bun src/deploy-all.ts
  process.exit(1);
}

const contracts = JSON.parse(readFileSync(CONTRACTS_FILE, 'utf-8'));
const contractAddress: string = contracts.counter.contractAddress;
console.log(`Counter contract address: ${contractAddress}`);

// ── Start servers ─────────────────────────────────────────────────────────────
console.log('');
console.log(`Starting ${N} servers...`);

const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>;

let serversProc: ReturnType<typeof Bun.spawn> | null = null;

function cleanup() {
  if (serversProc) {
    console.log('\nStopping servers...');
    serversProc.kill();
    serversProc = null;
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

serversProc = Bun.spawn(['bun', join(__dirname, 'run-servers.ts'), String(N)], {
  env,
  stdout: 'inherit',
  stderr: 'inherit',
});

// ── Wait for server 1 to be ready ────────────────────────────────────────────
console.log('');
console.log(`Waiting for server 1 at ${SERVER_URL} to be ready (timeout: ${READY_TIMEOUT_SECS}s)...`);

let elapsed = 0;
let ready = false;
while (elapsed < READY_TIMEOUT_SECS) {
  try {
    const res = await fetch(`${SERVER_URL}/health/ready`);
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {
    // not up yet
  }
  await Bun.sleep(3_000);
  elapsed += 3;
  console.log(`  Still waiting... (${elapsed}s)`);
}

if (!ready) {
  console.error(`Error: Server 1 wasn't ready within ${READY_TIMEOUT_SECS}s`);
  cleanup();
  process.exit(1);
}
console.log('Server 1 is ready.');

// ── Run the test ──────────────────────────────────────────────────────────────
console.log('');
console.log(`Running prove-and-sponsor test against ${SERVER_URL}...`);
console.log(`  Contract: ${contractAddress}`);
console.log(`  Network:  ${MIDNIGHT_NETWORK}`);
console.log('');

const testProc = Bun.spawnSync(
  [
    'bun',
    join(CONTRACTS_DIR, 'src/counter/cli/test/prove-and-sponsor.ts'),
    MIDNIGHT_NETWORK,
    contractAddress,
    '--server-url',
    SERVER_URL,
  ],
  { cwd: CONTRACTS_DIR, stderr: 'inherit' },
);

const output = testProc.stdout.toString();
console.log(output);

if (testProc.exitCode !== 0) {
  console.error('');
  console.error('✗ FAILED (non-zero exit)');
  cleanup();
  process.exit(1);
}

let parsed: { sponsorResponse?: { tx?: string }; bytes?: number };
try {
  parsed = JSON.parse(output);
} catch {
  console.error('');
  console.error('✗ FAILED: could not parse output as JSON');
  console.error(`  Output: ${output}`);
  cleanup();
  process.exit(1);
}

if (!parsed?.sponsorResponse?.tx) {
  console.error('');
  console.error("✗ FAILED: sponsor response does not contain a 'tx' field");
  console.error(`  Response: ${JSON.stringify(parsed?.sponsorResponse)}`);
  cleanup();
  process.exit(1);
}

console.log('');
console.log(`✓ PASSED (sponsor tx: ${parsed.sponsorResponse.tx.length} hex chars)`);
cleanup();
process.exit(0);