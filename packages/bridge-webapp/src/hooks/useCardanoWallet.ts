import { useState, useCallback } from 'react';
import type { Blaze } from '@blaze-cardano/sdk';
import type { Provider, Wallet } from '@blaze-cardano/sdk';
import { detectWallets, connectWallet, type DetectedWallet } from '../lib/cip30';

interface CardanoWalletState {
  wallets: DetectedWallet[];
  connectedWallet: string | null;
  address: string | null;
  balanceAda: string | null;
  blaze: Blaze<Provider, Wallet> | null;
  connecting: boolean;
  error: string | null;
  refreshWallets: () => void;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
}

export function useCardanoWallet(): CardanoWalletState {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balanceAda, setBalanceAda] = useState<string | null>(null);
  const [blaze, setBlaze] = useState<Blaze<Provider, Wallet> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWallets = useCallback(() => {
    setWallets(detectWallets());
  }, []);

  const connect = useCallback(async (walletName: string) => {
    setConnecting(true);
    setError(null);
    try {
      const connection = await connectWallet(walletName);
      setBlaze(connection.blaze);
      setConnectedWallet(walletName);
      setAddress(connection.address);
      setBalanceAda(connection.balanceAda);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectedWallet(null);
    setAddress(null);
    setBalanceAda(null);
    setBlaze(null);
    setError(null);
  }, []);

  return { wallets, connectedWallet, address, balanceAda, blaze, connecting, error, refreshWallets, connect, disconnect };
}
