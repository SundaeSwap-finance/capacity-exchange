import { useState, useCallback, useEffect } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { detectMidnightExtension, connectMidnightExtension } from '@sundaeswap/capacity-exchange-core';
import type { WalletCapabilities } from '../types';
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
  connectedAPI: ConnectedAPI | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook that manages the lifecycle of connecting to the Lace wallet extension.
 *
 * TODO(SUNDAE-2355): Replace with shared useWallet<T> from webapp-common
 */
export function useExtensionWallet(networkId: string): ExtensionWalletState {
  const detected = detectMidnightExtension();
  const connector = detected.ok ? detected.connector : null;
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected'
  );
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset connection state when networkId changes
  useEffect(() => {
    setWallet(null);
    setConnectedAPI(null);
    setError(null);
    setConnectionStatus('disconnected');
  }, [networkId]);

  const connect = useCallback(async () => {
    if (!connector || connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const result = await connectMidnightExtension(networkId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setWallet(new ExtensionWalletAdapter(networkId, result.wallet));
      setConnectedAPI(result.wallet);
      setConnectionStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConnectionStatus('error');
    }
  }, [connector, connectionStatus, networkId]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setConnectedAPI(null);
    setError(null);
    setConnectionStatus('disconnected');
  }, []);

  if (!connector) {
    return {
      status: 'unavailable',
      wallet: null,
      connectedAPI: null,
      error: null,
      connect: async () => {},
      disconnect: () => {},
    };
  }

  return {
    status: connectionStatus,
    wallet,
    connectedAPI,
    error,
    connect,
    disconnect,
  };
}
