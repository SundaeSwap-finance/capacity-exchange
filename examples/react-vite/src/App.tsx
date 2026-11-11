import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CapacityExchangeRoot,
  ChainStateProvider,
  indexerChainStateProvider,
  useCapacityExchangeWalletProvider,
  useSponsoredTransactionsWalletProvider,
} from '@sundaeswap/capacity-exchange-react-sdk';
import { Transaction, type ProvingProvider } from '@midnightntwrk/ledger-v9';
import { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import {
  IndexerPublicDataProvider,
  indexerPublicDataProvider,
} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  LedgerTransaction,
  createLedger9MidnightProvider,
  createLedger9ProofProvider,
  zkConfigToProvingKeyMaterial,
  type MidnightProviders,
  type UnboundTx,
  type ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js/types';
import { useMockWallet } from './mocks/wallet';

async function getWalletDetails(wallet: ConnectedAPI, zkConfigProvider: ZKConfigProvider<string>) {
  return Promise.all([
    wallet.getShieldedAddresses(),
    wallet.getConfiguration(),
    wallet.getProvingProvider(zkConfigProvider),
  ]);
}

type WalletDetails = Awaited<ReturnType<typeof getWalletDetails>>;

interface IndexerProviders {
  publicDataProvider: IndexerPublicDataProvider;
  chainStateProvider: ChainStateProvider;
}

// Indexer-backed providers hold open connections, so they must be disposed when no longer needed.
// Creating them inside an effect ties each instance to one effect run: the cleanup disposes them
// when the component unmounts or the indexer changes, and StrictMode's replay gets fresh instances.
// Returns null until the providers for the current indexer are ready.
function useIndexerProviders(indexerUri: string, indexerWsUri: string): IndexerProviders | null {
  const [state, setState] = useState<{ indexerUri: string; indexerWsUri: string; providers: IndexerProviders } | null>(
    null
  );
  useEffect(() => {
    const providers: IndexerProviders = {
      publicDataProvider: indexerPublicDataProvider({ queryURL: indexerUri, subscriptionURL: indexerWsUri }),
      // Provides on-chain state the SDK needs: contract state for the registry lookup
      // and current ledger parameters for fee estimation.
      chainStateProvider: indexerChainStateProvider(indexerUri, indexerWsUri),
    };
    setState({ indexerUri, indexerWsUri, providers });
    return () => {
      void Promise.all([providers.publicDataProvider.dispose(), providers.chainStateProvider.dispose()]);
    };
  }, [indexerUri, indexerWsUri]);

  // Don't hand out providers created for a previous indexer; they have already been disposed.
  if (!state || state.indexerUri !== indexerUri || state.indexerWsUri !== indexerWsUri) {
    return null;
  }
  return state.providers;
}

// Builds a set of Providers which work with Midnight APIs.
// This includes a WalletProvider which reaches out to the capacity exchange.
function useProviders<PCK extends string>(
  wallet: ConnectedAPI,
  zkConfigProvider: ZKConfigProvider<PCK>,
  [addresses, configuration, provingProvider]: WalletDetails,
  { publicDataProvider, chainStateProvider }: IndexerProviders
): MidnightProviders<PCK> {
  // This wallet provider will not actually spend DUST from the user's wallet.
  // Instead, it will reach out to a capacity-exchange server,
  // to request dust from a Liquidity Provider.
  const walletProvider = useCapacityExchangeWalletProvider({
    // Pass the networkId you're building TXs for. You can find this in wallet config.
    networkId: configuration.networkId,
    // Pass the coinPublicKey and encryptionPublicKey for the user's wallet.
    // These are necessary for the user to receive shielded tokens.
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    // These balance functions are necessary for the user to spend shielded or unshielded tokens.
    balanceUnsealedTransaction: wallet.balanceUnsealedTransaction,
    balanceSealedTransaction: wallet.balanceSealedTransaction,
    // Used by the SDK to discover registered CES servers from the on-chain registry
    // and to estimate fees.
    chainStateProvider,
  });

  // The rest of this is standard boilerplate to construct the remaining Midnight providers.
  // Your dApp is probably already doing most of this.
  return useMemo(() => {
    const accountId = addresses.shieldedCoinPublicKey;
    const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}`;

    const privateStateProvider = levelPrivateStateProvider({
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    });

    // The wallet proves; the ledger also asks for key material by location, which the
    // dApp's own zk config provider serves.
    const ledgerProvingProvider: ProvingProvider = {
      check: (preimage, keyLocation) => provingProvider.check(preimage, keyLocation),
      prove: (preimage, keyLocation, binding) => provingProvider.prove(preimage, keyLocation, binding),
      lookupKey: async (keyLocation) => zkConfigToProvingKeyMaterial(await zkConfigProvider.get(keyLocation as PCK)),
    };
    const proofProvider = createLedger9ProofProvider(ledgerProvingProvider);

    const midnightProvider = createLedger9MidnightProvider(async (tx) => {
      const id = tx.deserialize({ v9: Transaction }).identifiers()[0];
      await wallet.submitTransaction(Buffer.from(tx.serialize()).toString('hex'));
      return id;
    });

    return {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
      config: { networkId: configuration.networkId, ttlSeconds: 5 * 60 },
    };
  }, [wallet, zkConfigProvider, walletProvider, publicDataProvider, provingProvider, configuration.networkId]);
}

async function buildTx(providers: MidnightProviders): Promise<UnboundTx> {
  // Building an empty transaction. Your dApp will probably be more interesting!
  const unprovenTx = Transaction.fromParts(providers.config.networkId);
  return providers.proofProvider.proveTx(LedgerTransaction.seal('v9', 'Unproven', unprovenTx));
}

function MockFlow() {
  // To build the capacity exchange wallet provider, you need the user's wallet.
  // They don't need DUST, but may need to send or receive shielded or unshielded tokens.
  const wallet: ConnectedAPI = useMockWallet();

  const zkConfigProvider = useMemo(() => new FetchZkConfigProvider(window.location.origin), []);

  // NB: fetching information from a wallet is asynchronous,
  // and will prompt the user for permission. Wrap this component in suspense.
  const walletDetailsPromise = useMemo(() => getWalletDetails(wallet, zkConfigProvider), [wallet, zkConfigProvider]);
  const walletDetails = use(walletDetailsPromise);

  // The indexer URIs are available from your wallet's configuration.
  const [, configuration] = walletDetails;
  const indexerProviders = useIndexerProviders(configuration.indexerUri, configuration.indexerWsUri);
  if (!indexerProviders) {
    return null;
  }

  return (
    <TransactionFlow
      wallet={wallet}
      zkConfigProvider={zkConfigProvider}
      walletDetails={walletDetails}
      indexerProviders={indexerProviders}
    />
  );
}

interface TransactionFlowProps {
  wallet: ConnectedAPI;
  zkConfigProvider: ZKConfigProvider<string>;
  walletDetails: WalletDetails;
  indexerProviders: IndexerProviders;
}

function TransactionFlow({ wallet, zkConfigProvider, walletDetails, indexerProviders }: TransactionFlowProps) {
  // These providers are used by most Midnight transaction-building APIs.
  const providers = useProviders(wallet, zkConfigProvider, walletDetails, indexerProviders);

  // Here's how to use them to submit a transaction manually!
  const buildAndSubmitTx = useCallback(async () => {
    const tx = await buildTx(providers);

    // This is where the capacity exchange does its thing.
    const balancedTx = await providers.walletProvider.balanceTx(tx);

    await providers.midnightProvider.submitTx(balancedTx);
  }, [providers]);

  const sponsoredWalletProvider = useSponsoredTransactionsWalletProvider({
    // Pass the coinPublicKey and encryptionPublicKey for the user's wallet.
    // These are necessary for the user to receive shielded tokens.
    coinPublicKey: providers.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: providers.walletProvider.getEncryptionPublicKey(),
    // Pass the URL for the sponsoring capacity exchange.
    capacityExchangeUrl: 'http://localhost:3000',
  });

  const buildAndSubmitSponsoredTx = useCallback(async () => {
    const tx = await buildTx(providers);

    // The capacity exchange will balance this transaction for free.
    const balancedTx = await sponsoredWalletProvider.balanceTx(tx);

    await providers.midnightProvider.submitTx(balancedTx);
  }, [providers]);

  return (
    <div className="page">
      <h1>Capacity Exchange Flow</h1>
      <button className="btn" onClick={buildAndSubmitTx}>
        Submit TX
      </button>
      <button className="btn" onClick={buildAndSubmitSponsoredTx}>
        Submit Sponsored TX
      </button>
    </div>
  );
}

export function App() {
  return (
    <CapacityExchangeRoot>
      <MockFlow />
    </CapacityExchangeRoot>
  );
}
