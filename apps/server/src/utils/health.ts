export type IndexerStatus =
  { status: 'ok'; height: number } | { status: 'ko'; error: string; details?: string };

// Short enough that a hanging indexer can't hold /health/ready past a probe's own timeout.
const INDEXER_CHECK_TIMEOUT_MS = 5_000;

/** Queries the indexer's tip height. Never throws: every failure is reported as 'ko'. */
export async function checkIndexer(url: string): Promise<IndexerStatus> {
  // TODO: Find an indexer sdk or roll our own client
  // See https://github.com/SundaeSwap-finance/sundae-midnight/blob/main/backend/src/providers.ts#L123-L126
  // indexerPublicDataProvider
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ block { height } }' }),
      signal: AbortSignal.timeout(INDEXER_CHECK_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      status: 'ko',
      error: timedOut
        ? `Unreachable: timed out after ${INDEXER_CHECK_TIMEOUT_MS}ms`
        : `Unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return { status: 'ko', error: `Unreachable: HTTP ${response.status} ${response.statusText}` };
  }

  let data: { data?: { block?: { height: number } }; errors?: unknown[] };
  try {
    data = (await response.json()) as typeof data;
  } catch (err) {
    return {
      status: 'ko',
      error: 'Unexpected Indexer response: not JSON',
      details: err instanceof Error ? err.message : String(err),
    };
  }

  if (data.errors) {
    return {
      status: 'ko',
      error: 'GraphQL error',
      details: JSON.stringify(data.errors),
    };
  }

  if (!data.data || !data.data.block || !data.data.block.height) {
    return { status: 'ko', error: 'Unexpected Indexer response: no block height' };
  }

  return { status: 'ok', height: data.data.block.height };
}
