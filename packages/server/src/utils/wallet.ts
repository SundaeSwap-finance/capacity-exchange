import { DustParameters, DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v6';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { BaseConfig } from '../models/config';

export interface WalletContext {
  walletFacade: WalletFacade;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
  start: () => Promise<void>;
}

export const buildWalletContext = (
  config: BaseConfig,
  seedHex: string,
  state?: string,
): WalletContext => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));

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

  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
  const dustSecretKey = DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    derivationResult.keys[Roles.NightExternal],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.MIDNIGHT_NETWORK as any,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletConfiguration: any = {
    networkId: config.MIDNIGHT_NETWORK,
    // TODO: Determine appropriate vals for these
    // They control how much the wallet overestimates tx fees
    costParameters: {
      additionalFeeOverhead: 50_000_000_000_000n,
      feeBlocksMargin: 0,
    },
    // TODO: Check if this is the correct URL
    relayURL: new URL(config.NODE_URL),
    provingServerUrl: new URL(config.PROOF_SERVER_URL),
    indexerClientConnection: {
      indexerHttpUrl: config.INDEXER_URL,
      indexerWsUrl: config.INDEXER_WS_URL,
    },
    indexerUrl: config.INDEXER_WS_URL,
  };

  // These come from the spec
  // https://github.com/midnightntwrk/midnight-ledger/blob/main/spec/dust.md#initial-dust-parameters
  const params = new DustParameters(5_000_000_000n, 8_267n, 3n * 60n * 60n);
  const dustWalletClass = DustWallet(walletConfiguration);
  const dustWallet = state
    ? dustWalletClass.restore(state)
    : dustWalletClass.startWithSeed(derivationResult.keys[Roles.Dust], params);
  const shieldedWallet =
    ShieldedWallet(walletConfiguration).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet({
    ...walletConfiguration,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);

  return {
    walletFacade,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    start: async () => {
      await walletFacade.start(shieldedSecretKeys, dustSecretKey);
    },
  };
};
