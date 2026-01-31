import { useState, useCallback, useEffect } from 'react';
import type { WalletCapabilities } from '../types';
import { connectWallet } from './walletService';
import { useExtensionAvailability } from './useExtensionAvailability';
import { ExtensionWalletAdapter } from './ExtensionWalletAdapter';

/**
 * States for the extension wallet connection.
 *
 * - `unavailable`: Extension not found
 * - `disconnected`: Extension available but not connected
 * - `connecting`: Connection in progress, waiting for user approval
 * - `connected`: Successfully connected to the wallet
 * - `error`: Connection failed
 */
export type ExtensionWalletStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ExtensionWalletState {
  status: ExtensionWalletStatus;
  wallet: WalletCapabilities | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook that manages the lifecycle of connecting to the Lace wallet extension.
 */
export function useExtensionWallet(networkId: string): ExtensionWalletState {
  const availability = useExtensionAvailability();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected'
  );
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset connection state when networkId changes
  useEffect(() => {
    setWallet(null);
    setError(null);
    setConnectionStatus('disconnected');
  }, [networkId]);

  const connect = useCallback(async () => {
    if (availability.status !== 'available' || connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const connection = await connectWallet(availability.connector, networkId);
      setWallet(new ExtensionWalletAdapter(connection.wallet));
      setConnectionStatus('connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      // Provide helpful message for network mismatch
      if (message === 'Network ID mismatch') {
        setError(
          `Network mismatch: Your Lace wallet is configured for a different network. Please change Lace to "${networkId}" or select a different network in the dropdown.`
        );
      } else {
        setError(message);
      }

      setConnectionStatus('error');
    }
  }, [availability, connectionStatus, networkId]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError(null);
    setConnectionStatus('disconnected');
  }, []);

  if (availability.status === 'unavailable') {
    return {
      status: 'unavailable',
      wallet: null,
      error: null,
      connect: async () => {},
      disconnect: () => {},
    };
  }

  return {
    status: connectionStatus,
    wallet,
    error,
    connect,
    disconnect,
  };
}
