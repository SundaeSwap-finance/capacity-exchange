import WebSocket from 'ws';
import { createLogger } from './logger.js';

const logger = createLogger(import.meta);

const DUST_GRACE_PERIOD_SEC = 3 * 60 * 60; // 3 hours

function formatAge(sec: number): string {
  const min = Math.floor(sec / 60);
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return h > 0 ? `${h}h ${remMin}m` : `${min}m`;
}

async function fetchLatestBlock(indexerHttpUrl: string): Promise<{ height: number; ageSec: number }> {
  const res = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ block { height timestamp } }' }),
    signal: AbortSignal.timeout(10_000),
  });

  const json = (await res.json()) as { data?: { block?: { height: number; timestamp: number } } };
  const block = json.data?.block;
  if (!block) {
    throw new Error('Indexer returned no block data');
  }

  const ageSec = Math.floor(Date.now() / 1000) - block.timestamp / 1000;
  return { height: block.height, ageSec };
}

export function checkWebSocket(url: string, timeoutMs = 10_000): Promise<void> {
  logger.info(`Checking ws at ${url}...`);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Connection to ${url} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    ws.once('open', () => {
      clearTimeout(timer);
      ws.close();
      logger.info(`${url} is healthy`);
      resolve();
    });
    ws.once('error', () => {
      clearTimeout(timer);
      ws.terminate();
      reject(new Error(`Failed to connect to ${url}`));
    });
  });
}

export async function checkProofServer(proofServerUrl: string): Promise<void> {
  const url = `${proofServerUrl}/health`;
  logger.info(`Checking proof server at ${url}...`);

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = (await res.json()) as { status?: string };
  if (json.status !== 'ok') {
    throw new Error(`Proof server health check failed: ${JSON.stringify(json)}`);
  }
  logger.info('Proof server is healthy');
}

export async function checkIndexerFreshness(indexerHttpUrl: string): Promise<void> {
  logger.info(`Checking indexer freshness at ${indexerHttpUrl}...`);

  const { height, ageSec } = await fetchLatestBlock(indexerHttpUrl);
  const ageStr = formatAge(ageSec);

  logger.info(`Indexer at block ${height}, ${ageStr} ago`);

  if (ageSec > DUST_GRACE_PERIOD_SEC) {
    throw new Error(`Indexer is ${ageStr} behind (block ${height}). `);
  }
}
