import { DustTokenFullInfo, UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { FastifyBaseLogger } from 'fastify';
import { WalletService } from './wallet.js';

export interface UtxoLockInfo {
  id: string;
  utxo: DustTokenFullInfo;
  spend: UnprovenDustSpend;
  expiresAtMillis: number;
}

// TODO: decide if this the wallet service to own this type and actually return it
export type WalletUnavailableResult =
  | { status: 'insufficient-funds'; requested: bigint }
  | { status: 'wallet-syncing' }
  | { status: 'wallet-sync-failed'; error: string }
  | { status: 'illegal-state'; error: string };

export type LockUtxoResult = { status: 'ok'; value: UtxoLockInfo } | WalletUnavailableResult;

/**
 * Manages DUST UTxO locking and lifecycle.
 */
export class UtxoService {
  private readonly walletService: WalletService;
  private readonly logger: FastifyBaseLogger;
  private readonly utxoLockTtlSeconds: number;

  // Locked UTxO id -> expiry timestamp
  // TODO: Move this to a db for reliability (if the service restarts)
  private lockedUtxos = new Map<string, number>();

  constructor(walletService: WalletService, logger: FastifyBaseLogger, utxoLockTtlSeconds: number) {
    this.walletService = walletService;
    this.logger = logger;
    this.utxoLockTtlSeconds = utxoLockTtlSeconds;
  }

  private isLocked(key: string, now: number): boolean {
    const expiry = this.lockedUtxos.get(key);
    if (expiry === undefined) {
      return false;
    }
    if (expiry > now) {
      return true;
    }
    // Expired, clean up lazily
    this.lockedUtxos.delete(key);
    this.logger.debug({ id: key }, 'Cleaned up expired UTxO lock');
    return false;
  }

  private getLockId(utxoInfo: DustTokenFullInfo): string {
    // TODO: Determine the best key for a UTxO Lock Id
    return `${utxoInfo.token.backingNight}#${utxoInfo.token.mtIndex}`;
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
    this.lockedUtxos.set(key, expiresAt);
    this.logger.info({ id: key, expiresAt: new Date(expiresAt).toISOString() }, 'Locked UTxO');

    const spend = this.walletService.spend(selectedUtxo, specks);

    return {
      status: 'ok',
      value: {
        id: key,
        utxo: selectedUtxo,
        spend,
        expiresAtMillis: expiresAt,
      },
    };
  }
}
