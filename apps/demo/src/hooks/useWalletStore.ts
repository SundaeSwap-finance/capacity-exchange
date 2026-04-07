import { useState, useCallback, useEffect, useRef } from 'react';
import { generateMnemonic, mnemonicToSeedHex } from '@sundaeswap/capacity-exchange-core';
import type { EncryptedBlob, PlaintextSecrets, EncryptFn, DecryptFn, StorageMode } from '../lib/cryptoStore';
import { detectStorageMode, setupPasskey, unlockPasskey } from '../lib/cryptoStore';

const STORAGE_KEY = 'ces-demo-wallets';

// ── Storage types ──────────────────────────────────────────────────────

/** Wallet stored with passkey encryption. */
interface EncryptedStoredWallet {
  id: string;
  label: string;
  createdAt: number;
  encrypted: EncryptedBlob;
}

/** Legacy wallet stored in plaintext. */
interface PlaintextStoredWallet {
  id: string;
  label: string;
  createdAt: number;
  seedHex: string;
  mnemonic: string;
}

/** What we show in the UI (no secrets). */
export interface StoredWalletMeta {
  id: string;
  label: string;
  createdAt: number;
  mode: StorageMode;
}

/** Decrypted wallet secrets, available after unlock. */
export interface WalletSecrets {
  seedHex: string;
  mnemonic: string;
}

type RawStoredWallet = EncryptedStoredWallet | PlaintextStoredWallet;

function isEncrypted(w: RawStoredWallet): w is EncryptedStoredWallet {
  return 'encrypted' in w;
}

// ── localStorage helpers ───────────────────────────────────────────────

function loadRawWallets(): RawStoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRawWallets(wallets: RawStoredWallet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

function toMeta(wallets: RawStoredWallet[]): StoredWalletMeta[] {
  return wallets.map((w) => ({
    id: w.id,
    label: w.label,
    createdAt: w.createdAt,
    mode: isEncrypted(w) ? 'passkey' : 'plaintext',
  }));
}

// ── Hook ───────────────────────────────────────────────────────────────

export interface UseWalletStoreResult {
  wallets: StoredWalletMeta[];
  storageMode: StorageMode;
  /** True while the passkey is being set up or unlocked. */
  unlocking: boolean;
  /** Create a new wallet. Prompts for passkey if available. */
  createWallet: () => Promise<{ meta: StoredWalletMeta; secrets: WalletSecrets }>;
  /** Decrypt a saved wallet. Prompts for passkey if encrypted. */
  unlockWallet: (id: string) => Promise<WalletSecrets>;
  /** Remove a wallet from storage. */
  removeWallet: (id: string) => void;
  /** Set up passkey encryption. Returns true if successful. */
  enablePasskey: () => Promise<boolean>;
}

export function useWalletStore(): UseWalletStoreResult {
  const [walletMetas, setWalletMetas] = useState<StoredWalletMeta[]>(() => toMeta(loadRawWallets()));
  const [storageMode, setStorageMode] = useState<StorageMode>('plaintext');
  const [unlocking, setUnlocking] = useState(false);

  // Mutable refs for the encrypt/decrypt functions (set after passkey unlock)
  const encryptRef = useRef<EncryptFn | null>(null);
  const decryptRef = useRef<DecryptFn | null>(null);

  // Detect existing passkey on mount
  useEffect(() => {
    detectStorageMode().then(setStorageMode);
  }, []);

  const ensurePasskeyUnlocked = useCallback(async (): Promise<boolean> => {
    if (encryptRef.current && decryptRef.current) {
      return true;
    }
    setUnlocking(true);
    try {
      const result = await unlockPasskey();
      if (!result) {
        return false;
      }
      encryptRef.current = result.encryptFn;
      decryptRef.current = result.decryptFn;
      return true;
    } finally {
      setUnlocking(false);
    }
  }, []);

  const enablePasskey = useCallback(async (): Promise<boolean> => {
    // If already unlocked this session, we're good
    if (encryptRef.current && decryptRef.current) {
      return true;
    }

    setUnlocking(true);
    try {
      // Try unlocking an existing passkey first
      let result = await unlockPasskey();

      // If no existing passkey (or it was deleted), create a new one
      if (!result) {
        result = await setupPasskey();
      }

      if (!result) {
        return false;
      }
      encryptRef.current = result.encryptFn;
      decryptRef.current = result.decryptFn;
      setStorageMode('passkey');

      // Migrate existing plaintext wallets to encrypted
      const raw = loadRawWallets();
      const migrated: RawStoredWallet[] = [];
      for (const w of raw) {
        if (!isEncrypted(w)) {
          const encrypted = await result.encryptFn({ seedHex: w.seedHex, mnemonic: w.mnemonic });
          migrated.push({ id: w.id, label: w.label, createdAt: w.createdAt, encrypted });
        } else {
          migrated.push(w);
        }
      }
      saveRawWallets(migrated);
      setWalletMetas(toMeta(migrated));
      return true;
    } catch (err) {
      console.warn('[WalletStore] enablePasskey failed:', err);
      return false;
    } finally {
      setUnlocking(false);
    }
  }, []);

  const createWallet = useCallback(async (): Promise<{ meta: StoredWalletMeta; secrets: WalletSecrets }> => {
    const mnemonic = generateMnemonic();
    const seedHex = mnemonicToSeedHex(mnemonic);
    const secrets: PlaintextSecrets = { seedHex, mnemonic };
    const existing = loadRawWallets();
    const id = crypto.randomUUID();
    const label = `Wallet ${existing.length + 1}`;
    const createdAt = Date.now();

    let wallet: RawStoredWallet;
    let mode: StorageMode;

    if (encryptRef.current) {
      const encrypted = await encryptRef.current(secrets);
      wallet = { id, label, createdAt, encrypted };
      mode = 'passkey';
    } else {
      // Only store plaintext if no encryption is loaded — caller is
      // responsible for calling enablePasskey() first if they want encryption.
      wallet = { id, label, createdAt, seedHex, mnemonic };
      mode = 'plaintext';
    }

    const updated = [...existing, wallet];
    saveRawWallets(updated);
    setWalletMetas(toMeta(updated));

    return { meta: { id, label, createdAt, mode }, secrets };
  }, [storageMode]);

  const unlockWallet = useCallback(
    async (id: string): Promise<WalletSecrets> => {
      const raw = loadRawWallets();
      const wallet = raw.find((w) => w.id === id);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!isEncrypted(wallet)) {
        return { seedHex: wallet.seedHex, mnemonic: wallet.mnemonic };
      }

      // Need passkey to decrypt
      const unlocked = await ensurePasskeyUnlocked();
      if (!unlocked || !decryptRef.current) {
        throw new Error('Passkey authentication required to unlock this wallet');
      }

      return decryptRef.current(wallet.encrypted);
    },
    [ensurePasskeyUnlocked]
  );

  const removeWallet = useCallback((id: string) => {
    const updated = loadRawWallets().filter((w) => w.id !== id);
    saveRawWallets(updated);
    setWalletMetas(toMeta(updated));
  }, []);

  return {
    wallets: walletMetas,
    storageMode,
    unlocking,
    createWallet,
    unlockWallet,
    removeWallet,
    enablePasskey,
  };
}
