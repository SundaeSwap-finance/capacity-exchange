import { use, useCallback, useMemo } from 'react';
import {
  CapacityExchangeRoot,
  useCapacityExchangeWalletProvider,
  useSponsoredTransactionsWalletProvider,
} from '@capacity-exchange/react-sdk';
import { CostModel, FinalizedTransaction, Transaction, UnprovenTransaction } from '@midnight-ntwrk/ledger-v8';
import { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { MidnightProviders, ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import { useMockWallet } from './mocks/wallet';

async function getWalletDetails(wallet: ConnectedAPI, zkConfigProvider: ZKConfigProvider<string>) {
  return Promise.all([
    wallet.getShieldedAddresses(),
    wallet.getConfiguration(),
    wallet.getProvingProvider(zkConfigProvider),
  ]);
}

// Builds a set of Providers which work with Midnight APIs.
// This includes a WalletProvider which reaches out to the capacity exchange.
function useProviders<PCK extends string>(
  wallet: ConnectedAPI,
  zkConfigProvider: ZKConfigProvider<PCK>
): MidnightProviders<PCK> {
  // NB: fetching information from a wallet is asynchronous,
  // and will prompt the user for permission. Wrap this hook in suspense.
  const walletDetailsPromise = useMemo(() => getWalletDetails(wallet, zkConfigProvider), [wallet, zkConfigProvider]);
  const [addresses, configuration, provingProvider] = use(walletDetailsPromise);

  // This wallet provider will not actually spend DUST from the user's wallet.
  // Instead, it will reach out to a capacity-exchange server,
  // to request dust from a Liquidity Provider.
  const walletProvider = useCapacityExchangeWalletProvider({
    coinPublicKey: addresses.shieldedCoinPublicKey,
    encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
    balanceSealedTransaction: wallet.balanceSealedTransaction,
    indexerUrl: configuration.indexerUri,
    capacityExchangeUrls: ['http://localhost:3000'],
    margin: 3,
  });

  return useMemo(() => {
    const accountId = addresses.shieldedCoinPublicKey;
    const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}`;

    const privateStateProvider = levelPrivateStateProvider({
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    });

    const publicDataProvider = indexerPublicDataProvider(configuration.indexerUri, configuration.indexerWsUri);

    const proofProvider = {
      proveTx(tx: UnprovenTransaction) {
        return tx.prove(provingProvider, CostModel.initialCostModel());
      },
    };

    const midnightProvider = {
      async submitTx(tx: FinalizedTransaction) {
        const id = tx.identifiers()[0];
        const bytes = Buffer.from(tx.serialize()).toString('hex');
        await wallet.submitTransaction(bytes);
        return id;
      },
    };

    return {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    };
  }, [wallet, zkConfigProvider, walletProvider]);
}

function MockFlow() {
  // To build the capacity exchange wallet provider, you need the user's wallet.
  // They don't need DUST, but may need to send or receive shielded or unshielded tokens.
  const wallet: ConnectedAPI = useMockWallet();

  // These providers are used by most Midnight transaction-building APIs.
  const zkConfigProvider = useMemo(() => new FetchZkConfigProvider(window.location.origin), []);
  const providers = useProviders(wallet, zkConfigProvider);

  // Here's how to use them to submit a transaction manually!
  const buildAndSubmitTx = useCallback(async () => {
    // Building an empty transaction. Your dApp will probably be more interesting!
    const unprovenTx = Transaction.fromParts('preview');
    const provenTx = await providers.proofProvider.proveTx(unprovenTx);

    // This is where the capacity exchange does its thing.
    const balancedTx = await providers.walletProvider.balanceTx(provenTx);

    await providers.midnightProvider.submitTx(balancedTx);
  }, [providers]);

  const sponsoredWalletProvider = useSponsoredTransactionsWalletProvider({
    walletProvider: providers.walletProvider,
    capacityExchangeUrl: 'http://localhost:3000',
  });

  const buildAndSubmitSponsoredTx = useCallback(async () => {
    const unprovenTx = Transaction.fromParts('preview');
    const provenTx = await providers.proofProvider.proveTx(unprovenTx);

    // The capacity exchange will balance this transaction for free.
    const balancedTx = await sponsoredWalletProvider.balanceTx(provenTx);

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
