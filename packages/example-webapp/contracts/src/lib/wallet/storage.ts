import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../logger.js';

const logger = createLogger(import.meta);
type WalletStateName = 'shielded' | 'dust';

const STORAGE_DIR = '.midnight-wallet-state';

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function getFilePath(name: string, suffix: string): string {
  return path.join(STORAGE_DIR, `${name}-${suffix}.json`);
}

export function saveWalletState(name: string, suffix: string, serializedState: string): void {
  ensureStorageDir();
  const filePath = getFilePath(name, suffix);
  fs.writeFileSync(filePath, serializedState, 'utf-8');
  logger.log(`Saved ${name} state to ${filePath}`);
}

export function loadWalletState(name: string, suffix: string): string | null {
  const filePath = getFilePath(name, suffix);
  if (!fs.existsSync(filePath)) {
    logger.log(`No saved state for ${name}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    logger.log(`Loaded ${name} state from ${filePath}`);
    return data;
  } catch (error) {
    logger.error(`Failed to load ${name} state:`, error);
    return null;
  }
}

export function clearWalletState(name: string, suffix: string): void {
  const filePath = getFilePath(name, suffix);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.log(`Cleared ${name} state`);
  }
}
