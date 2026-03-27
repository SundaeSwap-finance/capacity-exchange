import type pino from 'pino';
import {
  resolveWalletConfig,
  createWallet,
  WalletStateStore,
  deriveWalletKeys,
  parseSeedHex,
  parseMnemonic,
  uint8ArrayToHex,
  type WalletConnection,
} from '@capacity-exchange/midnight-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { FileStateStore, loadWalletSeed } from '@capacity-exchange/midnight-node';
import type { AppEnv } from './env.js';
import { readFileOrError } from './files.js';
import { fetchSecret } from './secrets.js';

const WALLET_SOURCE_VARS = ['WALLET_SEED_FILE', 'WALLET_MNEMONIC_FILE', 'WALLET_MNEMONIC_ARN'] as const;

async function resolveWalletSeedHex(env: AppEnv, log: pino.Logger): Promise<string> {
  const specified = WALLET_SOURCE_VARS.filter((k) => env[k]);
  if (specified.length > 1) {
    throw new Error(`Only one wallet source allowed, but multiple were set: ${specified.join(', ')}`);
  }
  if (env.WALLET_MNEMONIC_ARN) {
    log.info(`Loading wallet mnemonic from AWS Secrets Manager: ${env.WALLET_MNEMONIC_ARN}`);
    const mnemonic = await fetchSecret(env.WALLET_MNEMONIC_ARN);
    return uint8ArrayToHex(parseMnemonic(mnemonic));
  }
  if (env.WALLET_MNEMONIC_FILE) {
    log.info(`Loading wallet from mnemonic file: ${env.WALLET_MNEMONIC_FILE}`);
    const mnemonic = readFileOrError(env.WALLET_MNEMONIC_FILE, 'Failed to read wallet mnemonic from');
    return uint8ArrayToHex(parseMnemonic(mnemonic));
  }
  if (env.WALLET_SEED_FILE) {
    log.info(`Loading wallet from seed file: ${env.WALLET_SEED_FILE}`);
    const seedStr = readFileOrError(env.WALLET_SEED_FILE, 'Failed to read wallet seed from');
    parseSeedHex(seedStr);
    return seedStr.trim();
  }
  if (env.MIDNIGHT_NETWORK.toLowerCase() === 'mainnet') {
    throw new Error('WALLET_MNEMONIC_FILE, WALLET_SEED_FILE, or WALLET_MNEMONIC_ARN is required on mainnet');
  }
  log.info(`Loading wallet via convention file (walk-up from cwd)`);
  return uint8ArrayToHex(loadWalletSeed(env.MIDNIGHT_NETWORK));
}

export interface WalletResources {
  walletConnection: WalletConnection;
  walletStateStore: WalletStateStore;
}

/** Load the wallet seed, restore state, and create the wallet connection. */
export async function createWalletResources(
  env: AppEnv,
  networkId: NetworkId.NetworkId,
  logger: pino.Logger,
): Promise<WalletResources> {
  const walletSeed = await resolveWalletSeedHex(env, logger);
  const keys = deriveWalletKeys(walletSeed, networkId);

  const walletStateStore = new WalletStateStore(
    new FileStateStore(env.WALLET_STATE_DIR, logger),
    String(networkId),
    keys.shieldedSecretKeys.coinPublicKey,
    {
      debounceMs: 1000,
      onFlushError: (err) => logger.error(err, 'Failed to flush wallet state'),
    },
  );

  const saved = await walletStateStore.loadWalletState();
  const walletConnection = await createWallet({
    seedHex: walletSeed,
    walletConfig: resolveWalletConfig(networkId, env.PROOF_SERVER_URL),
    ...saved,
  });

  return { walletConnection, walletStateStore };
}
