import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ces-demo-wallets';

export interface StoredWallet {
  id: string;
  seedHex: string;
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

function generateRandomSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useWalletStore() {
  const [wallets, setWallets] = useState<StoredWallet[]>(loadWallets);

  const createWallet = useCallback((): StoredWallet => {
    const existing = loadWallets();
    const wallet: StoredWallet = {
      id: crypto.randomUUID(),
      seedHex: generateRandomSeed(),
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
