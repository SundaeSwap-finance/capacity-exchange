import { DustSecretKey, ZswapSecretKeys, DustParameters } from '@midnight-ntwrk/ledger-v6';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, UnshieldedKeystore, UnshieldedWallet, InMemoryTransactionHistoryStorage, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Config } from '../../../config';

/**
 * Converts a hex string to Uint8Array (browser-compatible alternative to Buffer.from)
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Dust wallet parameters from spec
const DUST_PARAMS = new DustParameters(5_000_000_000n, 8_267n, 3n * 60n * 60n);

// Cost parameters for fee estimation
const COST_PARAMS = {
  additionalFeeOverhead: 50_000_000_000_000n,
  feeBlocksMargin: 0,
} as const;

export interface WalletKeys {
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

/**
 * Derives wallet keys from a seed hex string.
 */
export function deriveWalletKeys(seedHex: string, networkId: NetworkId.NetworkId): WalletKeys {
  const hdWallet = HDWallet.fromSeed(hexToBytes(seedHex));

  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();

  return {
    shieldedSecretKeys: ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]),
    dustSecretKey: DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]),
    unshieldedKeystore: createKeystore(derivationResult.keys[Roles.NightExternal], networkId),
  };
}

export interface SeedWalletConnection {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  networkId: string;
}

/**
 * Creates and syncs a wallet from a seed.
 */
export async function connectSeedWallet(seedHex: string, config: Config): Promise<SeedWalletConnection> {
  console.log('[WalletService] Connecting with seed:', seedHex.slice(0, 8) + '...' + seedHex.slice(-8));
  console.log('[WalletService] Full seed length:', seedHex.length);
  const networkId = config.networkId as NetworkId.NetworkId;
  const keys = deriveWalletKeys(seedHex, networkId);
  console.log('[WalletService] Derived coin public key:', keys.shieldedSecretKeys.coinPublicKey.slice(0, 16) + '...');

  const walletConfig = {
    networkId,
    costParameters: COST_PARAMS,
    relayURL: new URL(config.nodeWsUrl),
    provingServerUrl: new URL(config.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: config.indexerUrl,
      indexerWsUrl: config.indexerWsUrl,
    },
    indexerUrl: config.indexerWsUrl,
  };

  const dustWallet = DustWallet(walletConfig).startWithSecretKey(keys.dustSecretKey, DUST_PARAMS);
  const shieldedWallet = ShieldedWallet(walletConfig).startWithSecretKeys(keys.shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet({
    ...walletConfig,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(keys.unshieldedKeystore));

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);

  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  console.log('[WalletService] Wallet started, waiting for sync...');

  const [shieldedState, dustState] = await Promise.all([
    walletFacade.shielded.waitForSyncedState(),
    walletFacade.dust.waitForSyncedState(),
  ]);

  console.log('[WalletService] Wallet synced');
  console.log('[WalletService] Shielded balances:', shieldedState.balances);
  console.log('[WalletService] Shielded address coin public key:', shieldedState.coinPublicKey?.toHexString?.() ?? 'N/A');
  console.log('[WalletService] Dust balance:', dustState.walletBalance(new Date()));

  return { walletFacade, keys, networkId: config.networkId };
}
