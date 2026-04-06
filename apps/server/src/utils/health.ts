export type IndexerStatus =
  | { status: 'ok'; height: number }
  | { status: 'ko'; error: string; details?: string };

export async function checkIndexer(url: string): Promise<IndexerStatus> {
  // TODO: Find an indexer sdk or roll our own client
  // See https://github.com/SundaeSwap-finance/sundae-midnight/blob/main/backend/src/providers.ts#L123-L126
  // indexerPublicDataProvider
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ block { height } }' }),
  });

  if (!response.ok) {
    return { status: 'ko', error: `Unreachable: ${response.statusText}` };
  }

  const data = (await response.json()) as {
    data?: { block?: { height: number } };
    errors?: unknown[];
  };

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
