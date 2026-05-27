import http from 'http';
import https from 'https';
import { createLogger } from './createLogger.js';

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
    const httpUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const { protocol, hostname, port, pathname } = new URL(httpUrl);
    const mod = protocol === 'https:' ? https : http;
    const key = Buffer.from(Math.random().toString()).toString('base64');

    const req = mod.request({
      hostname,
      port: port || (protocol === 'https:' ? 443 : 80),
      path: pathname || '/',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        Host: hostname,
      },
    });

    let settled = false;
    const done = (fn: () => void) => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      req.destroy();
      done(() => reject(new Error(`Connection to ${url} timed out after ${timeoutMs / 1000}s`)));
    }, timeoutMs);

    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      done(() => {
        logger.info(`${url} is healthy`);
        resolve();
      });
    });

    req.on('response', (res) => {
      res.resume();
      done(() => reject(new Error(`Failed to connect to ${url}: server returned HTTP ${res.statusCode} ${res.statusMessage}`)));
    });

    req.on('error', (err) => {
      done(() => reject(new Error(`Failed to connect to ${url}: ${err.message}`)));
    });

    req.end();
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
