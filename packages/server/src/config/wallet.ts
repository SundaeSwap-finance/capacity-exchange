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
import { FileStateStore, loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import type { AppEnv } from './env.js';
import { readFileOrError } from './files.js';

function loadWalletSeed(env: AppEnv, log: pino.Logger): string {
  if (env.WALLET_SEED_FILE && env.WALLET_MNEMONIC_FILE) {
    throw new Error("Can't specify both WALLET_SEED_FILE and WALLET_MNEMONIC_FILE");
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
    throw new Error('WALLET_MNEMONIC_FILE or WALLET_SEED_FILE is required on mainnet');
  }
  log.info(`Loading wallet via wallet-mnemonic.${env.MIDNIGHT_NETWORK}.txt (walk-up)`);
  return uint8ArrayToHex(loadWalletSeedFromFile(env.MIDNIGHT_NETWORK));
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
  const walletSeed = loadWalletSeed(env, logger);
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
  const walletConnection = createWallet({
    seedHex: walletSeed,
    walletConfig: resolveWalletConfig(networkId, env.PROOF_SERVER_URL),
    ...saved,
  });

  return { walletConnection, walletStateStore };
}
