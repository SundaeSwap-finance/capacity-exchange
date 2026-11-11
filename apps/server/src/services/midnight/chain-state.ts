import { FastifyBaseLogger } from 'fastify';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import type { LedgerParameters } from '@midnightntwrk/ledger-v9';
import type { ChainHealth } from '../../models/health.js';

const TIP_POLL_INTERVAL_MS = 2_000;
const LEDGER_PARAMS_POLL_INTERVAL_MS = 60_000;
const INDEXER_FETCH_TIMEOUT_MS = 10_000;

const BLOCK_TIMESTAMP_QUERY = `query { block { timestamp } }`;

/** Thrown by the getters until the first indexer fetch lands. Served as a 503. */
export class ChainStateNotReadyError extends Error {
  readonly statusCode = 503;
  constructor(what: string) {
    super(`Midnight chain state is not loaded yet (${what}). Please try again shortly.`);
    this.name = 'ChainStateNotReadyError';
  }
}

export class MidnightChainStateService implements ChainHealth {
  private readonly indexerUrl: string;
  private readonly logger: FastifyBaseLogger;
  private tip: Date | null = null;
  private params: LedgerParameters | null = null;
  private lastError: string | null = null;
  private tipInFlight = false;
  private paramsInFlight = false;
  private tipTimer?: ReturnType<typeof setInterval>;
  private paramsTimer?: ReturnType<typeof setInterval>;

  constructor(indexerUrl: string, logger: FastifyBaseLogger) {
    this.indexerUrl = indexerUrl;
    this.logger = logger;
  }

  /**
   * Starts polling the indexer for tip + ledger params. Does not wait for the first fetch: the
   * indexer can be slow or erroring at boot, and that must not stop the server from starting.
   * Until both values have loaded, the getters throw {@link ChainStateNotReadyError} and
   * {@link health} reports 'syncing'. Ledger params are retried at the tip cadence until loaded.
   */
  start(): void {
    this.pollTip();
    this.pollParams();
    this.tipTimer = setInterval(() => {
      this.pollTip();
      if (!this.params) {
        this.pollParams();
      }
    }, TIP_POLL_INTERVAL_MS);
    this.paramsTimer = setInterval(() => this.pollParams(), LEDGER_PARAMS_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.tipTimer) {
      clearInterval(this.tipTimer);
      this.tipTimer = undefined;
    }
    if (this.paramsTimer) {
      clearInterval(this.paramsTimer);
      this.paramsTimer = undefined;
    }
  }

  isReady(): boolean {
    return this.tip !== null && this.params !== null;
  }

  health() {
    if (this.isReady()) {
      return { status: 'ok' as const };
    }
    return this.lastError
      ? { status: 'syncing' as const, error: this.lastError }
      : { status: 'syncing' as const };
  }

  latestBlockTimestamp(): Date {
    if (!this.tip) {
      throw new ChainStateNotReadyError('block timestamp');
    }
    // Defensive copy so callers can't mutate the cached tip.
    return new Date(this.tip.getTime());
  }

  ledgerParameters(): LedgerParameters {
    if (!this.params) {
      throw new ChainStateNotReadyError('ledger parameters');
    }
    return this.params;
  }

  // Each poll skips if the previous one is still in flight, so a hanging indexer
  // doesn't pile up concurrent requests.
  private pollTip(): void {
    if (this.tipInFlight) {
      return;
    }
    this.tipInFlight = true;
    this.refreshTip()
      .catch((err) => this.onRefreshError('tip', err))
      .finally(() => {
        this.tipInFlight = false;
      });
  }

  private pollParams(): void {
    if (this.paramsInFlight) {
      return;
    }
    this.paramsInFlight = true;
    this.refreshParams()
      .catch((err) => this.onRefreshError('ledgerParameters', err))
      .finally(() => {
        this.paramsInFlight = false;
      });
  }

  private onRefreshError(what: string, err: unknown): void {
    this.lastError = `${what}: ${err instanceof Error ? err.message : String(err)}`;
    const loaded = what === 'tip' ? this.tip !== null : this.params !== null;
    this.logger.warn(
      { err },
      loaded
        ? `ChainStateService ${what} refresh failed; keeping last known value`
        : `ChainStateService ${what} initial load failed; retrying`,
    );
  }

  private async refreshTip(): Promise<void> {
    const response = await fetch(this.indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: BLOCK_TIMESTAMP_QUERY }),
      signal: AbortSignal.timeout(INDEXER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Indexer returned HTTP ${response.status} for block.timestamp query`);
    }
    const result = (await response.json()) as { data?: { block?: { timestamp?: number } } };
    const timestamp = result?.data?.block?.timestamp;
    if (typeof timestamp !== 'number') {
      throw new Error(`Indexer returned no block.timestamp (got: ${JSON.stringify(result)})`);
    }
    const wasReady = this.isReady();
    this.tip = new Date(timestamp);
    this.onLoaded(wasReady);
  }

  private async refreshParams(): Promise<void> {
    const params = await getLedgerParameters(this.indexerUrl, {
      signal: AbortSignal.timeout(INDEXER_FETCH_TIMEOUT_MS),
    });
    const wasReady = this.isReady();
    this.params = params;
    this.onLoaded(wasReady);
  }

  private onLoaded(wasReady: boolean): void {
    if (!wasReady && this.isReady()) {
      this.lastError = null;
      this.logger.info('ChainStateService loaded tip and ledger parameters from the indexer');
    }
  }
}
