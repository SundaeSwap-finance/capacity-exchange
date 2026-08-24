import { indexerQuery } from './indexer.js';

/** A transaction's raw serialized bytes, by one of its identifiers. Identifiers survive a
 *  merge, the tx hash does not. Must be hex, it is interpolated into the query. */
export async function queryTxRaw(indexerUrl: string, txId: string, signal?: AbortSignal): Promise<string> {
  if (!/^([0-9a-fA-F]{2})+$/.test(txId)) {
    throw new Error(`Invalid txId, expected hex: ${txId.slice(0, 32)}`);
  }
  const query = `query { transactions(offset: { identifier: "${txId}" }) { raw } }`;
  const data = await indexerQuery<{ transactions?: { raw?: string }[] }>(indexerUrl, query, 'transactions.raw', signal);
  const rows = data.transactions ?? [];
  if (rows.length !== 1) {
    throw new Error(`expected one tx for ${txId.slice(0, 16)}, got ${rows.length}`);
  }
  const raw = rows[0].raw;
  if (!raw) {
    throw new Error(`Indexer returned no raw tx for ${txId.slice(0, 16)}`);
  }
  return raw;
}
