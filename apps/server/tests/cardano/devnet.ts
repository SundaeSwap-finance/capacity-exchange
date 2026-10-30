import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { expect, vi } from 'vitest';
import { ReadyResponse } from '../../src/models/health.js';
import { CLIENT } from '../utils.js';

/** The devnet from testnet/cardano.yml, driven through cardano-cli in its node container. */
const NODE_CONTAINER = 'cardano-devnet-node';
const TESTNET_DIR = new URL('../../../../testnet/cardano/', import.meta.url).pathname;
// Where cardano.yml mounts testnet/cardano inside the node container.
const KEYS_DIR = '/keys';
// cardano-cli's `latest` is still Conway, which the Dijkstra node rejects.
const ERA = 'dijkstra';

export const FUNDED_ADDRESS = readFileSync(`${TESTNET_DIR}funded.addr`, 'utf8').trim();
export const SERVER_ADDRESS = readFileSync(`${TESTNET_DIR}server.addr`, 'utf8').trim();

function cardanoCli(...args: string[]): string {
  return execFileSync('docker', ['exec', NODE_CONTAINER, 'cardano-cli', ERA, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Pays `lovelace` to `address` from the funded key and returns the transaction id.
 * The next payment must wait until this one is on chain: both spend the funded
 * key's change.
 */
export function fund(address: string, lovelace: bigint): string {
  const utxos = JSON.parse(
    cardanoCli('query', 'utxo', '--address', FUNDED_ADDRESS, '--output-json'),
  );
  const [txIn] = Object.keys(utxos);
  if (!txIn) {
    throw new Error(`The funded address ${FUNDED_ADDRESS} has no UTxOs`);
  }

  const file = `/tmp/fund-${randomUUID()}`;
  cardanoCli(
    'transaction',
    'build',
    '--tx-in',
    txIn,
    '--tx-out',
    `${address}+${lovelace}`,
    '--change-address',
    FUNDED_ADDRESS,
    '--out-file',
    `${file}.raw`,
  );
  cardanoCli(
    'transaction',
    'sign',
    '--tx-body-file',
    `${file}.raw`,
    '--signing-key-file',
    `${KEYS_DIR}/funded.skey`,
    '--out-file',
    `${file}.signed`,
  );
  cardanoCli('transaction', 'submit', '--tx-file', `${file}.signed`);
  return JSON.parse(cardanoCli('transaction', 'txid', '--tx-file', `${file}.signed`)).txhash;
}

type CardanoStatus = NonNullable<typeof ReadyResponse.static.cardano>;

export async function cardanoStatus(): Promise<CardanoStatus> {
  const { cardano } = (await CLIENT.getReadiness()).data;
  if (!cardano) {
    throw new Error('The server reports no Cardano status; is it configured for Cardano?');
  }
  return cardano;
}

/**
 * Pays `lovelace` to the server wallet and waits until the server has seen it.
 * The wallet only sees blocks from where the server started following, so it
 * cannot see funds paid before then: tests that need ADA must pay it this way.
 */
export async function fundServerWallet(lovelace: bigint): Promise<void> {
  // Payments must wait until the server is following the tip.
  await vi.waitFor(async () => expect((await cardanoStatus()).status).toBe('ok'), {
    timeout: 30_000,
  });
  const before = BigInt((await cardanoStatus()).walletLovelace!);

  fund(SERVER_ADDRESS, lovelace);

  // A block every second; a missing payment usually means the server could not
  // parse its block (see its log).
  await vi.waitFor(
    async () => expect(BigInt((await cardanoStatus()).walletLovelace!)).toBe(before + lovelace),
    { timeout: 30_000 },
  );
}
