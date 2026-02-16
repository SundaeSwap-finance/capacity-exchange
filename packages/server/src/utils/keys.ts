import { DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v6';
import { AccountKey, HDWallet, Role, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export interface IKeys {
  dust: DustSecretKey;
  dustSeed: Uint8Array;
  zswap: ZswapSecretKeys;
}

const buildHDWallet = (seed: Uint8Array): HDWallet => {
  const wallet = HDWallet.fromSeed(seed);
  if (wallet.type === 'seedError') {
    throw wallet.error;
  } else {
    return wallet.hdWallet;
  }
};

const deriveSeed = (account: AccountKey, role: Role): Uint8Array => {
  const result = account.selectRole(role).deriveKeyAt(0);
  if (result.type === 'keyOutOfBounds') {
    throw new Error('Key out of bounds');
  }
  return result.key;
};

export const deriveKeysFromSeed = async (seed: Uint8Array): Promise<IKeys> => {
  const account = buildHDWallet(seed).selectAccount(0);
  const dustSeed = deriveSeed(account, Roles.Dust);
  return {
    dust: DustSecretKey.fromSeed(dustSeed),
    dustSeed,
    zswap: ZswapSecretKeys.fromSeed(deriveSeed(account, Roles.Zswap)),
  };
};

export const deriveKeys = async (seedHex: string): Promise<IKeys> => {
  return deriveKeysFromSeed(Buffer.from(seedHex.trim(), 'hex'));
};
