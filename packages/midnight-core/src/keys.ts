import { DustSecretKey, ZswapSecretKeys } from '@midnightntwrk/ledger-v9';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk';
import { HDWallet, Roles, WalletSeeds } from '@midnight-ntwrk/wallet-sdk/hd';
import { createKeystore, UnshieldedKeystore } from '@midnight-ntwrk/wallet-sdk/unshielded';
import { hexToBytes } from './hex.js';

export interface WalletKeys {
  /** Per-wallet seeds the WalletFacade is started from. Each ledger version derives its own keys from them. */
  seeds: WalletSeeds;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

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

  const seeds: WalletSeeds = {
    shielded: derivationResult.keys[Roles.Zswap],
    unshielded: derivationResult.keys[Roles.NightExternal],
    dust: derivationResult.keys[Roles.Dust],
  };

  return {
    seeds,
    shieldedSecretKeys: ZswapSecretKeys.fromSeed(seeds.shielded),
    dustSecretKey: DustSecretKey.fromSeed(seeds.dust),
    unshieldedKeystore: createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId),
  };
}
