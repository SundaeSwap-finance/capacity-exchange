import { FastifyBaseLogger } from 'fastify';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';

const TIP_POLL_INTERVAL_MS = 2_000;
const LEDGER_PARAMS_POLL_INTERVAL_MS = 60_000;
const INDEXER_FETCH_TIMEOUT_MS = 10_000;

const BLOCK_TIMESTAMP_QUERY = `query { block { timestamp } }`;

export class ChainStateService {
  private readonly indexerUrl: string;
  private readonly logger: FastifyBaseLogger;
  private tip: Date | null = null;
  private params: LedgerParameters | null = null;
  private tipTimer?: ReturnType<typeof setInterval>;
  private paramsTimer?: ReturnType<typeof setInterval>;

  constructor(indexerUrl: string, logger: FastifyBaseLogger) {
    this.indexerUrl = indexerUrl;
    this.logger = logger;
  }

  /** Primes tip + ledger params from the indexer. Throws if either fetch fails. */
  async start(): Promise<void> {
    await Promise.all([this.refreshTip(), this.refreshParams()]);
    this.tipTimer = setInterval(() => {
      this.refreshTip().catch((err) => {
        this.logger.warn({ err }, 'ChainStateService tip refresh failed; keeping last known value');
      });
    }, TIP_POLL_INTERVAL_MS);
    this.paramsTimer = setInterval(() => {
      this.refreshParams().catch((err) => {
        this.logger.warn(
          { err },
          'ChainStateService ledgerParameters refresh failed; keeping last known value',
        );
      });
    }, LEDGER_PARAMS_POLL_INTERVAL_MS);
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

  latestBlockTimestamp(): Date {
    if (!this.tip) {
      throw new Error('ChainStateService not started: prime tip before use');
    }
    // Defensive copy so callers can't mutate the cached tip.
    return new Date(this.tip.getTime());
  }

  ledgerParameters(): LedgerParameters {
    if (!this.params) {
      throw new Error('ChainStateService not started: prime ledgerParameters before use');
    }
    return this.params;
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
    this.tip = new Date(timestamp);
  }

  private async refreshParams(): Promise<void> {
    this.params = await getLedgerParameters(this.indexerUrl, {
      signal: AbortSignal.timeout(INDEXER_FETCH_TIMEOUT_MS),
    });
  }
}
