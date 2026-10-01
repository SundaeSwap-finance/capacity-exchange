import type { DustFullInfo, UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk/dust/v1';
import { FastifyBaseLogger } from 'fastify';
import type { CapacitySource } from '../metrics.js';
import { MidnightWalletService } from './wallet.js';
import { MidnightChainStateService } from './chain-state.js';
import { LRUCache } from 'lru-cache';

export interface UtxoLockInfo {
  id: string;
  utxo: DustFullInfo;
  spend: UnprovenDustSpend;
  ctime: Date;
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
  specks: bigint;
}

/**
 * Manages DUST UTxO locking and lifecycle.
 */
export class MidnightUtxoService implements CapacitySource {
  private readonly walletService: MidnightWalletService;
  private readonly chainStateService: MidnightChainStateService;
  private readonly logger: FastifyBaseLogger;
  private readonly utxoLockTtlSeconds: number;
  // TODO: Move this to a db for reliability (if the service restarts)
  private readonly locks: LRUCache<string, UtxoLock>;

  constructor(
    walletService: MidnightWalletService,
    chainStateService: MidnightChainStateService,
    logger: FastifyBaseLogger,
    utxoLockTtlSeconds: number,
  ) {
    this.walletService = walletService;
    this.chainStateService = chainStateService;
    this.logger = logger;
    this.utxoLockTtlSeconds = utxoLockTtlSeconds;
    this.locks = new LRUCache<string, UtxoLock>({
      ttl: utxoLockTtlSeconds * 1000,
      ttlAutopurge: true,
    });
  }

  private getLockId(utxoInfo: DustFullInfo): string {
    // TODO: Determine the best key for a UTxO Lock Id
    return `${utxoInfo.token.backingNight}#${utxoInfo.token.mtIndex}`;
  }

  available(): bigint {
    const state = this.walletService.state;
    return state ? state.balance(new Date()) : 0n;
  }

  lockedUtxos(): { count: number; amount: bigint } {
    let count = 0;
    let amount = 0n;
    this.locks.forEach((lock) => {
      count++;
      amount += lock.specks;
    });
    return { count, amount };
  }

  totalUtxos(): number {
    const walletState = this.walletService.state;
    if (!walletState) {
      return 0;
    }
    const availableCoins = walletState.capabilities.coinsAndBalances.getAvailableCoins(
      walletState.state,
      new Date(),
    );
    return availableCoins.length;
  }

  /** Releases a lock early */
  unlock(id: string): void {
    this.locks.delete(id);
    this.logger.info({ id }, 'Released UTxO lock');
  }

  lockUtxo(specks: bigint): LockUtxoResult {
    const now = Date.now();
    const ctime = this.chainStateService.latestBlockTimestamp();
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

    //const utxos = walletState.availableCoins;
    const utxos = walletState.capabilities.coinsAndBalances.getAvailableCoins(
      walletState.state,
      ctime,
    );
    this.logger.debug({ utxos }, 'Got DUST wallet UTxOs');

    const selectedUtxo = utxos.find((utxoInfo) => {
      const key = this.getLockId(utxoInfo);
      if (this.locks.has(key)) {
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
    this.locks.set(key, { specks });
    this.logger.info(
      { id: key, ctime, expiresAt: new Date(expiresAt).toISOString() },
      'Locked UTxO',
    );

    const spend = this.walletService.spend(selectedUtxo, specks, ctime);

    return {
      status: 'ok',
      value: {
        id: key,
        utxo: selectedUtxo,
        spend,
        ctime,
        expiresAtMillis: expiresAt,
      },
    };
  }
}
