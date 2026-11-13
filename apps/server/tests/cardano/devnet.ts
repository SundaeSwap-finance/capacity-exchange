import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { expect, vi } from 'vitest';
import { TransactionId, TxIn } from '@capacity-exchange/cardano-core';
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
 * Builds a transaction spending the funded key's UTxO, with `args` added to the
 * build, signs it with the funded key, submits it and returns its id.
 * The next transaction must wait until this one is on chain: both spend the funded
 * key's change.
 */
function submitFromFunded(...args: string[]): string {
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
    ...args,
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

/**
 * Pays `lovelace` to `address` from the funded key and returns the transaction id.
 * The next payment must wait until this one is on chain: both spend the funded
 * key's change.
 */
export function fund(address: string, lovelace: bigint): string {
  return submitFromFunded('--tx-out', `${address}+${lovelace}`);
}

/**
 * The policy of the tokens `mintTokens` mints: a native script that only needs the
 * funded key's signature (testnet/cardano/token.policy.json). The funded key is
 * checked in, so the id is the same on every devnet.
 */
export const TEST_TOKEN_POLICY_ID = '9c8399adf0897796faeaac794629cf7edd4960daa593366243fb1e6c';

export interface TestWallet {
  address: string;
  /** The 32-byte Ed25519 payment signing key, hex. */
  signingKey: string;
  /** The 32-byte Ed25519 payment verification key, hex. */
  verificationKey: string;
}

/** Generates a fresh payment key and its enterprise address. It holds nothing until funded. */
export function createTestWallet(): TestWallet {
  const file = `/tmp/wallet-${randomUUID()}`;
  cardanoCli(
    'address',
    'key-gen',
    '--verification-key-file',
    `${file}.vkey`,
    '--signing-key-file',
    `${file}.skey`,
  );
  const address = cardanoCli(
    'address',
    'build',
    '--payment-verification-key-file',
    `${file}.vkey`,
  ).trim();
  const keyHex = (path: string): string => {
    const { cborHex } = JSON.parse(
      execFileSync('docker', ['exec', NODE_CONTAINER, 'cat', path], { encoding: 'utf8' }),
    );
    // A CBOR byte string of 32 bytes: 0x58 0x20, then the key.
    return cborHex.slice(4);
  };
  return { address, signingKey: keyHex(`${file}.skey`), verificationKey: keyHex(`${file}.vkey`) };
}

/**
 * Mints `quantity` of the token `assetName` (UTF-8) under `TEST_TOKEN_POLICY_ID`,
 * pays it with `lovelace` to `address`, and waits until the output is on chain.
 * Returns the output, so a test can spend it.
 */
export async function mintTokens(
  address: string,
  assetName: string,
  quantity: bigint,
  lovelace = 2_000_000n,
): Promise<TxIn> {
  const asset = `${TEST_TOKEN_POLICY_ID}.${Buffer.from(assetName, 'utf8').toString('hex')}`;
  const txId = submitFromFunded(
    // `transaction build` puts the change after the given outputs, so this is output 0.
    '--tx-out',
    `${address}+${lovelace}+${quantity} ${asset}`,
    '--mint',
    `${quantity} ${asset}`,
    '--mint-script-file',
    `${KEYS_DIR}/token.policy.json`,
  );
  const txIn: TxIn = { txId: TransactionId(txId), index: 0 };

  await vi.waitFor(
    () => {
      const utxos = JSON.parse(
        cardanoCli('query', 'utxo', '--tx-in', `${txId}#0`, '--output-json'),
      );
      expect(Object.keys(utxos)).toHaveLength(1);
    },
    { timeout: 30_000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  return txIn;
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
