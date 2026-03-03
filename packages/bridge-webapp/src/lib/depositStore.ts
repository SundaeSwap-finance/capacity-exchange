export interface Deposit {
  txHash: string;
  lovelace: bigint;
  coinPublicKey: string;
  submittedAt: number;
  status: 'unconfirmed' | 'confirmed';
}

const STORAGE_KEY = 'capacity-exchange:deposits';

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function bigintReviver(key: string, value: unknown): unknown {
  return key === 'lovelace' && typeof value === 'string' ? BigInt(value) : value;
}

// --- Subscription for useSyncExternalStore ---

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns the raw localStorage string as the snapshot (cheap identity check for useSyncExternalStore). */
export function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '[]';
}

// --- Read/write ---

export function loadDeposits(): Deposit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw, bigintReviver) as Deposit[];
  } catch {
    return [];
  }
}

function writeDeposits(deposits: Deposit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deposits, bigintReplacer));
  emitChange();
}

export function saveDeposit(deposit: Deposit): void {
  const deposits = loadDeposits();
  const existing = deposits.findIndex((d) => d.txHash === deposit.txHash);
  if (existing >= 0) {
    deposits[existing] = deposit;
  } else {
    deposits.push(deposit);
  }
  writeDeposits(deposits);
}

export function markConfirmed(txHash: string): void {
  const deposits = loadDeposits();
  const deposit = deposits.find((d) => d.txHash === txHash);
  if (deposit) {
    deposit.status = 'confirmed';
    writeDeposits(deposits);
  }
}
