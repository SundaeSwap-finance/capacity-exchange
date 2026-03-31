import { useState, useCallback } from 'react';
import { generateMnemonic, mnemonicToSeedHex } from '@capacity-exchange/midnight-core';

const STORAGE_KEY = 'ces-demo-wallets';

export interface StoredWallet {
  id: string;
  seedHex: string;
  mnemonic: string;
  label: string;
  createdAt: number;
}

function loadWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWallets(wallets: StoredWallet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function useWalletStore() {
  const [wallets, setWallets] = useState<StoredWallet[]>(loadWallets);

  const createWallet = useCallback((): StoredWallet => {
    const existing = loadWallets();
    const mnemonic = generateMnemonic();
    const wallet: StoredWallet = {
      id: crypto.randomUUID(),
      seedHex: mnemonicToSeedHex(mnemonic),
      mnemonic,
      label: `Wallet ${existing.length + 1}`,
      createdAt: Date.now(),
    };
    const updated = [...existing, wallet];
    saveWallets(updated);
    setWallets(updated);
    return wallet;
  }, []);

  const removeWallet = useCallback((id: string) => {
    const updated = loadWallets().filter((w) => w.id !== id);
    saveWallets(updated);
    setWallets(updated);
  }, []);

  return { wallets, createWallet, removeWallet };
}
