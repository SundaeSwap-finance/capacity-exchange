import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

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
