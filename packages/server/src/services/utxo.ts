import type { DustFullInfo, UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import { FastifyBaseLogger } from 'fastify';
import { WalletService } from './wallet.js';

export interface UtxoLockInfo {
  id: string;
  utxo: DustFullInfo;
  spend: UnprovenDustSpend;
  syncTime: Date,
  expiresAtMillis: number;
}

// TODO: decide if this the wallet service to own this type and actually return it
export type WalletUnavailableResult =
  | { status: 'insufficient-funds'; requested: bigint }
  | { status: 'wallet-syncing' }
  | { status: 'wallet-sync-failed'; error: string }
  | { status: 'illegal-state'; error: string };

export type LockUtxoResult = { status: 'ok'; value: UtxoLockInfo } | WalletUnavailableResult;

interface UtxoLock {
  expiresAt: number;
  specks: bigint;
}

/**
 * Manages DUST UTxO locking and lifecycle.
 */
export class UtxoService {
  private readonly walletService: WalletService;
  private readonly logger: FastifyBaseLogger;
  private readonly utxoLockTtlSeconds: number;

  // TODO: Move this to a db for reliability (if the service restarts)
  private lockedUtxos = new Map<string, UtxoLock>();

  constructor(walletService: WalletService, logger: FastifyBaseLogger, utxoLockTtlSeconds: number) {
    this.walletService = walletService;
    this.logger = logger;
    this.utxoLockTtlSeconds = utxoLockTtlSeconds;
  }

  private isLocked(key: string, now: number): boolean {
    const lock = this.lockedUtxos.get(key);
    if (lock === undefined) {
      return false;
    }
    if (lock.expiresAt > now) {
      return true;
    }
    // Expired, clean up lazily
    this.lockedUtxos.delete(key);
    this.logger.debug({ id: key }, 'Cleaned up expired UTxO lock');
    return false;
  }

  private getLockId(utxoInfo: DustFullInfo): string {
    // TODO: Determine the best key for a UTxO Lock Id
    return `${utxoInfo.token.backingNight}#${utxoInfo.token.mtIndex}`;
  }

  getLockedUtxoStats(): { count: number; totalSpecks: bigint } {
    const now = Date.now();
    let count = 0;
    let totalSpecks = 0n;
    for (const [key, lock] of this.lockedUtxos) {
      if (lock.expiresAt > now) {
        count++;
        totalSpecks += lock.specks;
      } else {
        this.lockedUtxos.delete(key);
      }
    }
    return { count, totalSpecks };
  }

  getTotalUtxoCount(): number {
    const walletState = this.walletService.state;
    if (!walletState) return 0;
    return walletState.availableCoinsWithFullInfo(new Date()).length;
  }

  lockUtxo(specks: bigint): LockUtxoResult {
    const walletState = this.walletService.state;
    const walletSyncState = this.walletService.syncState;

    if (walletSyncState.status === 'syncing') {
      return { status: 'wallet-syncing' };
    }

    if (walletSyncState.status === 'ko') {
      return { status: 'wallet-sync-failed', error: walletSyncState.error };
    }

    if (!walletState) {
      // We should be sync'd and have the wallet state at this point, this is unexpected
      return { status: 'illegal-state', error: "Wallet is sync'd but no wallet state" };
    }

    const syncTime = walletState.state.state.syncTime;

    const utxos = walletState.availableCoinsWithFullInfo(new Date());
    this.logger.debug({ utxos }, 'Got DUST wallet UTxOs');

    const now = Date.now();
    const selectedUtxo = utxos.find((utxoInfo) => {
      const key = this.getLockId(utxoInfo);
      if (this.isLocked(key, now)) {
        return false;
      }
      // generatedNow is the calculated specks available on the UTxO
      return utxoInfo.generatedNow >= specks;
    });

    if (!selectedUtxo) {
      return { status: 'insufficient-funds', requested: specks };
    }

    const expiresAt = now + this.utxoLockTtlSeconds * 1000;
    const key = this.getLockId(selectedUtxo);
    this.lockedUtxos.set(key, { expiresAt, specks });
    this.logger.info({ id: key, ctime: syncTime, expiresAt: new Date(expiresAt).toISOString() }, 'Locked UTxO');

    const spend = this.walletService.spend(selectedUtxo, specks, syncTime);

    return {
      status: 'ok',
      value: {
        id: key,
        utxo: selectedUtxo,
        spend,
        syncTime,
        expiresAtMillis: expiresAt,
      },
    };
  }
}
