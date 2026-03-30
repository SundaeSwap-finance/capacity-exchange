import type { DustFullInfo, UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import { FastifyBaseLogger } from 'fastify';
import { WalletService } from './wallet.js';
import { TtlCache } from '../utils/ttl-cache.js';

export interface UtxoLockInfo {
  id: string;
  utxo: DustFullInfo;
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
  private readonly lockedUtxos: TtlCache<true>;

  constructor(walletService: WalletService, logger: FastifyBaseLogger, utxoLockTtlSeconds: number) {
    this.walletService = walletService;
    this.logger = logger;
    this.utxoLockTtlSeconds = utxoLockTtlSeconds;
    this.lockedUtxos = new TtlCache(utxoLockTtlSeconds, 'utxo-locks', logger);
  }

  stop(): void {
    this.lockedUtxos.stop();
  }

  private getLockId(utxoInfo: DustFullInfo): string {
    // TODO: Determine the best key for a UTxO Lock Id
    return `${utxoInfo.token.backingNight}#${utxoInfo.token.mtIndex}`;
  }

  /** Releases a lock early */
  unlock(id: string): void {
    this.lockedUtxos.delete(id);
    this.logger.info({ id }, 'Released UTxO lock');
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

    const selectedUtxo = utxos.find((utxoInfo) => {
      const key = this.getLockId(utxoInfo);
      if (this.lockedUtxos.has(key)) {
        return false;
      }
      // generatedNow is the calculated specks available on the UTxO
      return utxoInfo.generatedNow >= specks;
    });

    if (!selectedUtxo) {
      return { status: 'insufficient-funds', requested: specks };
    }

    const now = Date.now();
    const expiresAt = now + this.utxoLockTtlSeconds * 1000;
    const key = this.getLockId(selectedUtxo);
    this.lockedUtxos.set(key, true, expiresAt);
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
