import { DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v7';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, UnshieldedKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { hexToBytes } from './hex';

export interface WalletKeys {
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

  return {
    shieldedSecretKeys: ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]),
    dustSecretKey: DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]),
    unshieldedKeystore: createKeystore(derivationResult.keys[Roles.NightExternal], networkId),
  };
}
