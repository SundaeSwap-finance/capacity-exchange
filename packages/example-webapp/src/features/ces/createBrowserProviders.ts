import type { WalletProvider, ProofProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type {
  ZswapSecretKeys,
  DustSecretKey,
  FinalizedTransaction,
  CoinPublicKey,
  EncPublicKey,
  ShieldedCoinInfo,
  UnprovenTransaction,
} from '@midnight-ntwrk/ledger-v6';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { Config } from '../../config';
import { uint8ArrayToHex } from '../../utils/hex';
import { createSeedWalletConnectedAPIAdapter } from './seedWalletConnectedApi';
import { SeedDustWalletProvider } from './seedDustWalletProvider';

function createMidnightProvider(connectedAPI: ConnectedAPI): MidnightProvider {
  return {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      const serialized = tx.serialize();
      await connectedAPI.submitTransaction(uint8ArrayToHex(serialized));
      return tx.identifiers()[0];
    },
  };
}

function createMinimalWalletProvider(shieldedAddress: ShieldedAddressInfo): WalletProvider {
  return {
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey as CoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey as EncPublicKey;
    },
    async balanceTx(_tx: UnprovenTransaction, _newCoins?: ShieldedCoinInfo[], _ttl?: Date) {
      throw new Error('balanceTx should be handled by capacityExchangeWalletProvider');
    },
  };
}

export interface BrowserProviders {
  walletProvider: WalletProvider;
  connectedAPI: ConnectedAPI;
  proofProvider: ProofProvider<string>;
  midnightProvider: MidnightProvider;
}

export interface ShieldedAddressInfo {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export interface SeedWalletInfo {
  walletFacade: WalletFacade;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  shieldedAddress: ShieldedAddressInfo;
  unshieldedAddress: string;
  dustAddress: string;
}

export function createProvidersFromSeedWallet(seedWalletInfo: SeedWalletInfo, config: Config): BrowserProviders {
  const { walletFacade, shieldedSecretKeys, dustSecretKey, shieldedAddress, unshieldedAddress, dustAddress } =
    seedWalletInfo;

  const connectedAPI = createSeedWalletConnectedAPIAdapter(
    walletFacade,
    shieldedSecretKeys,
    dustSecretKey,
    shieldedAddress,
    unshieldedAddress,
    dustAddress,
    config
  );

  const dustWallet = walletFacade.dust as DustWallet;
  const walletProvider = new SeedDustWalletProvider(dustWallet, shieldedSecretKeys, dustSecretKey);
  const proofProvider = httpClientProofProvider(config.proofServerUrl);
  const midnightProvider = createMidnightProvider(connectedAPI);

  return { walletProvider, connectedAPI, proofProvider, midnightProvider };
}

export function createProvidersFromExtensionWallet(
  connectedAPI: ConnectedAPI,
  shieldedAddress: ShieldedAddressInfo,
  config: Config
): BrowserProviders {
  const walletProvider = createMinimalWalletProvider(shieldedAddress);
  const proofProvider = httpClientProofProvider(config.proofServerUrl);
  const midnightProvider = createMidnightProvider(connectedAPI);

  return { walletProvider, connectedAPI, proofProvider, midnightProvider };
}
