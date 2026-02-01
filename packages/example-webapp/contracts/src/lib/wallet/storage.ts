import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = '.midnight-wallet-state';

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function getFilePath(name: string): string {
  return path.join(STORAGE_DIR, `${name}.json`);
}

export function saveWalletState(name: string, serializedState: string): void {
  ensureStorageDir();
  const filePath = getFilePath(name);
  fs.writeFileSync(filePath, serializedState, 'utf-8');
  console.error(`[WalletStorage] Saved ${name} state to ${filePath}`);
}

export function loadWalletState(name: string): string | null {
  const filePath = getFilePath(name);
  if (!fs.existsSync(filePath)) {
    console.error(`[WalletStorage] No saved state for ${name}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    console.error(`[WalletStorage] Loaded ${name} state from ${filePath}`);
    return data;
  } catch (error) {
    console.error(`[WalletStorage] Failed to load ${name} state:`, error);
    return null;
  }
}

export function clearWalletState(name: string): void {
  const filePath = getFilePath(name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.error(`[WalletStorage] Cleared ${name} state`);
  }
}
