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
import { FileStateStore, loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import type { AppEnv } from './env.js';
import type { ResolvedNetwork } from './network.js';
import { readFileOrError } from './files.js';

async function loadWalletSeed(env: AppEnv, log: pino.Logger): Promise<string> {
  if (env.walletSeedFile && env.walletMnemonicFile) {
    throw new Error("Can't specify both WALLET_SEED_FILE and WALLET_MNEMONIC_FILE");
  }
  if (env.walletMnemonicFile) {
    log.info(`Loading wallet from mnemonic file: ${env.walletMnemonicFile}`);
    const mnemonic = await readFileOrError(env.walletMnemonicFile, 'Failed to read wallet mnemonic from');
    return uint8ArrayToHex(parseMnemonic(mnemonic));
  }
  if (env.walletSeedFile) {
    log.info(`Loading wallet from seed file: ${env.walletSeedFile}`);
    const seedStr = await readFileOrError(env.walletSeedFile, 'Failed to read wallet seed from');
    parseSeedHex(seedStr);
    return seedStr.trim();
  }
  if (env.networkId.toLowerCase() === 'mainnet') {
    throw new Error('WALLET_MNEMONIC_FILE or WALLET_SEED_FILE is required on mainnet');
  }
  log.info(`Loading wallet via wallet-mnemonic.${env.networkId}.txt (walk-up)`);
  return uint8ArrayToHex(loadWalletSeedFromFile(env.networkId));
}

export interface WalletResources {
  walletConnection: WalletConnection;
  walletStateStore: WalletStateStore;
}

/** Load the wallet seed, restore state, and create the wallet connection. */
export async function createWalletResources(
  env: AppEnv,
  network: ResolvedNetwork,
  logger: pino.Logger,
): Promise<WalletResources> {
  const walletSeed = await loadWalletSeed(env, logger);
  const keys = deriveWalletKeys(walletSeed, network.networkId);

  const walletStateStore = new WalletStateStore(
    new FileStateStore(env.walletStateDir, logger),
    String(network.networkId),
    keys.shieldedSecretKeys.coinPublicKey,
    {
      debounceMs: 1000,
      onFlushError: (err) => logger.error(err, 'Failed to flush wallet state'),
    },
  );

  const saved = await walletStateStore.loadWalletState();
  const walletConnection = createWallet({
    seedHex: walletSeed,
    walletConfig: resolveWalletConfig(network.networkId, env.proofServerUrl),
    ...saved,
  });

  return { walletConnection, walletStateStore };
}
