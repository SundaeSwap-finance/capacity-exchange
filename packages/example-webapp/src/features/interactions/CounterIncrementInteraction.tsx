import { useMemo, useState, useEffect } from 'react';
import { LoadingSpinner, EditableField } from '../../shared/ui';
import { useContractContextOptional } from '../contract/ContractContext';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities } from '../wallet/types';
import { useCESTransaction, CurrencySelectionModal, OfferConfirmationModal } from '../ces';
import {
  createProvidersFromSeedWallet,
  createProvidersFromExtensionWallet,
  type BrowserProviders,
  type ShieldedAddressInfo,
} from '../ces/createBrowserProviders';
import { config } from '../../config';
import { formatDust } from '../../utils/format';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

interface SeedWalletConnection {
  type: 'seed';
  walletFacade: unknown;
  shieldedSecretKeys: {
    coinPublicKey: string;
    encryptionPublicKey: string;
  };
  dustSecretKey: unknown;
}

interface ExtensionWalletConnection {
  type: 'extension';
  connectedAPI: ConnectedAPI;
}

export type WalletConnection = SeedWalletConnection | ExtensionWalletConnection;

interface CounterIncrementInteractionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

const statusMessages: Record<string, string> = {
  idle: '',
  building: 'Building transaction...',
  'selecting-currency': 'Select payment currency',
  confirming: 'Confirm offer',
  submitting: 'Submitting transaction...',
  success: 'Transaction successful!',
  error: 'Transaction failed',
};

export function CounterIncrementInteraction({
  wallet,
  walletConnection,
}: CounterIncrementInteractionProps) {
  const contractContext = useContractContextOptional();
  const walletInfo = useWalletInfo(wallet);
  const defaultContractAddress = contractContext?.counterContractAddress ?? '';
  const [shieldedAddressInfo, setShieldedAddressInfo] = useState<ShieldedAddressInfo | null>(null);

  // Editable field with auto-populated default
  const [contractAddress, setContractAddress] = useState(defaultContractAddress);

  // Update contract address when deployment changes
  useEffect(() => {
    if (defaultContractAddress) {
      setContractAddress(defaultContractAddress);
    }
  }, [defaultContractAddress]);

  useEffect(() => {
    if (walletConnection.type === 'extension') {
      walletConnection.connectedAPI.getShieldedAddresses().then(setShieldedAddressInfo);
    }
  }, [walletConnection]);

  const providers = useMemo<BrowserProviders | null>(() => {
    if (walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      const shieldedAddress = {
        shieldedAddress: walletInfo.data.shieldedAddress,
        shieldedCoinPublicKey: walletConnection.shieldedSecretKeys.coinPublicKey,
        shieldedEncryptionPublicKey: walletConnection.shieldedSecretKeys.encryptionPublicKey,
      };
      return createProvidersFromSeedWallet(
        {
          walletFacade: walletConnection.walletFacade,
          shieldedSecretKeys: walletConnection.shieldedSecretKeys,
          dustSecretKey: walletConnection.dustSecretKey,
          shieldedAddress,
          unshieldedAddress: walletInfo.data.unshieldedAddress,
          dustAddress: walletInfo.data.dustAddress,
        } as Parameters<typeof createProvidersFromSeedWallet>[0],
        config
      );
    } else {
      if (!shieldedAddressInfo) {
        return null;
      }
      return createProvidersFromExtensionWallet(
        walletConnection.connectedAPI,
        shieldedAddressInfo,
        config
      );
    }
  }, [walletInfo, walletConnection, shieldedAddressInfo]);

  const effectiveContractAddress = contractAddress || null;
  const ces = useCESTransaction(providers, effectiveContractAddress);

  if (walletInfo.status === 'loading') {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-dark-200">Increment Counter</h4>
        <LoadingSpinner message="Loading wallet info..." />
      </div>
    );
  }

  if (walletInfo.status === 'error') {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-dark-200">Increment Counter</h4>
        <div className="text-red-400 text-xs">{walletInfo.error}</div>
      </div>
    );
  }

  const canIncrement =
    effectiveContractAddress !== null && providers !== null && ces.status === 'idle';
  const isProcessing =
    ces.status !== 'idle' && ces.status !== 'success' && ces.status !== 'error';

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Increment Counter</h4>

      <div className="p-2 bg-purple-900/20 border border-purple-700/50 rounded">
        <p className="text-purple-300 text-xs">
          Forces CES flow regardless of your DUST balance.
        </p>
      </div>

      <div className="p-2 bg-dark-800 rounded border border-dark-600">
        <div className="flex justify-between items-center">
          <span className="text-xs text-dark-400">Current DUST Balance</span>
          <span className="text-white font-mono text-sm">{formatDust(walletInfo.data.dustBalance)}</span>
        </div>
      </div>

      <EditableField
        label="Counter Contract Address"
        value={contractAddress}
        defaultValue={defaultContractAddress}
        onChange={setContractAddress}
        placeholder="Deploy a counter contract or enter address"
        disabled={isProcessing}
      />

      <button
        onClick={ces.incrementCounter}
        disabled={!canIncrement || isProcessing}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? 'Processing...' : 'Increment Counter (via CES)'}
      </button>

      {isProcessing && ces.status !== 'selecting-currency' && ces.status !== 'confirming' && (
        <LoadingSpinner message={statusMessages[ces.status]} />
      )}

      {ces.status === 'success' && (
        <div className="p-2 bg-green-900/20 border border-green-700/50 rounded">
          <p className="text-green-400 text-xs">Counter incremented successfully!</p>
        </div>
      )}

      {ces.status === 'error' && ces.error && (
        <div className="p-2 bg-red-900/20 border border-red-700/50 rounded">
          <p className="text-red-400 text-xs">{ces.error}</p>
        </div>
      )}

      {ces.currencySelection && (
        <CurrencySelectionModal
          prices={ces.currencySelection.prices}
          dustRequired={ces.currencySelection.dustRequired}
          onSelect={ces.onCurrencySelected}
        />
      )}

      {ces.offerConfirmation && (
        <OfferConfirmationModal
          offer={ces.offerConfirmation.offer}
          dustRequired={ces.offerConfirmation.dustRequired}
          onConfirm={ces.onOfferConfirmed}
        />
      )}
    </div>
  );
}
