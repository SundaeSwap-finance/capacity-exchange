import { indexerQuery } from './indexer.js';

const query = 'query { block { timestamp } }';

/** Latest block timestamp from the indexer. Dust spends require this as their
 *  ctime rather than wall-clock time. */
export async function getLatestBlockTimestamp(indexerUrl: string, signal?: AbortSignal): Promise<Date> {
  const data = await indexerQuery<{ block?: { timestamp?: number } }>(indexerUrl, query, 'block.timestamp', signal);
  const timestamp = data.block?.timestamp;
  if (typeof timestamp !== 'number') {
    throw new Error(`Indexer returned no block.timestamp (got: ${JSON.stringify(data)})`);
  }
  return new Date(timestamp);
}
