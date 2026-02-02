import { useMemo, useState, useEffect } from 'react';
import { LoadingSpinner, EditableField } from '../../shared/ui';
import { useContractContextOptional } from '../contract/ContractContext';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities } from '../wallet/types';
import { useTokenMintTransaction } from '../ces';
import {
  createProvidersFromSeedWallet,
  createProvidersFromExtensionWallet,
  type BrowserProviders,
  type ShieldedAddressInfo,
} from '../ces/createBrowserProviders';
import { config } from '../../config';
import { formatDust } from '../../utils/format';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const DEFAULT_MINT_AMOUNT = '1000';

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

type WalletConnection = SeedWalletConnection | ExtensionWalletConnection;

interface TokenMintInteractionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

const statusMessages: Record<string, string> = {
  idle: '',
  building: 'Building transaction...',
  submitting: 'Submitting transaction...',
  success: 'Transaction successful!',
  error: 'Transaction failed',
};

export function TokenMintInteraction({ wallet, walletConnection }: TokenMintInteractionProps) {
  const contractContext = useContractContextOptional();
  const walletInfo = useWalletInfo(wallet);
  const tokenMintContract = contractContext?.tokenMintContract ?? null;
  const defaultContractAddress = tokenMintContract?.contractAddress ?? '';
  const [shieldedAddressInfo, setShieldedAddressInfo] = useState<ShieldedAddressInfo | null>(null);

  // Editable fields with auto-populated defaults
  const [contractAddress, setContractAddress] = useState(defaultContractAddress);
  const [mintAmount, setMintAmount] = useState(DEFAULT_MINT_AMOUNT);

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
  const mint = useTokenMintTransaction(providers, effectiveContractAddress);

  const handleMint = () => {
    const amount = BigInt(mintAmount || '0');
    if (amount > 0n) {
      mint.mintTokens(amount);
    }
  };

  if (walletInfo.status === 'loading') {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-dark-200">Mint Tokens</h4>
        <LoadingSpinner message="Loading wallet info..." />
      </div>
    );
  }

  if (walletInfo.status === 'error') {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-dark-200">Mint Tokens</h4>
        <div className="text-red-400 text-xs">{walletInfo.error}</div>
      </div>
    );
  }

  const canMint =
    effectiveContractAddress !== null &&
    providers !== null &&
    mint.status === 'idle' &&
    mintAmount &&
    BigInt(mintAmount) > 0n;
  const isProcessing = mint.status === 'building' || mint.status === 'submitting';

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Mint Tokens</h4>

      <div className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded">
        <p className="text-yellow-300 text-xs">
          Uses your DUST balance to pay transaction fees.
        </p>
      </div>

      <div className="p-2 bg-dark-800 rounded border border-dark-600">
        <div className="flex justify-between items-center">
          <span className="text-xs text-dark-400">Current DUST Balance</span>
          <span className="text-white font-mono text-sm">{formatDust(walletInfo.data.dustBalance)}</span>
        </div>
      </div>

      <EditableField
        label="Token Contract Address"
        value={contractAddress}
        defaultValue={defaultContractAddress}
        onChange={setContractAddress}
        placeholder="Deploy a token mint contract or enter address"
        disabled={isProcessing}
      />

      <EditableField
        label="Mint Amount"
        value={mintAmount}
        defaultValue={DEFAULT_MINT_AMOUNT}
        onChange={setMintAmount}
        placeholder="Enter amount to mint"
        type="number"
        disabled={isProcessing}
      />

      <button
        onClick={handleMint}
        disabled={!canMint || isProcessing}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? 'Processing...' : `Mint ${mintAmount || '0'} Tokens`}
      </button>

      {isProcessing && (
        <LoadingSpinner message={statusMessages[mint.status]} />
      )}

      {mint.status === 'success' && (
        <div className="p-2 bg-green-900/20 border border-green-700/50 rounded">
          <p className="text-green-400 text-xs">Tokens minted successfully to your wallet!</p>
        </div>
      )}

      {mint.status === 'error' && mint.error && (
        <div className="p-2 bg-red-900/20 border border-red-700/50 rounded">
          <p className="text-red-400 text-xs">{mint.error}</p>
        </div>
      )}
    </div>
  );
}
