import { useState, useCallback } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { WalletCapabilities } from '../types';
import { connectWallet } from './walletService';
import { useExtensionAvailability } from './useExtensionAvailability';

/**
 * States for the extension wallet connection.
 *
 * - `unavailable`: Extension not found
 * - `disconnected`: Extension available but not connected
 * - `connecting`: Connection in progress, waiting for user approval
 * - `connected`: Successfully connected to the wallet
 */
export type ExtensionWalletStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected';

export interface ExtensionWalletState {
  status: ExtensionWalletStatus;
  wallet: WalletCapabilities | null;
  connectedAPI: ConnectedAPI | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook that manages the lifecycle of connecting to the Lace wallet extension.
 */
export function useExtensionWallet(networkId: string): ExtensionWalletState {
  const availability = useExtensionAvailability();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);

  const connect = useCallback(async () => {
    if (availability.status !== 'available' || connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }

    setConnectionStatus('connecting');

    const connection = await connectWallet(availability.connector, networkId);
    setWallet(connection.wallet);
    setConnectedAPI(connection.wallet);
    setConnectionStatus('connected');
  }, [availability, connectionStatus, networkId]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setConnectedAPI(null);
    setConnectionStatus('disconnected');
  }, []);

  if (availability.status === 'unavailable') {
    return {
      status: 'unavailable',
      wallet: null,
      connectedAPI: null,
      connect: async () => {},
      disconnect: () => {},
    };
  }

  return {
    status: connectionStatus,
    wallet,
    connectedAPI,
    connect,
    disconnect,
  };
}
