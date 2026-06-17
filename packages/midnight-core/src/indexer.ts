/** Shared transport for GraphQL queries against the Midnight indexer. `label`
 *  names the query for error messages (e.g. 'block.timestamp'). */
export async function indexerQuery<T>(
  indexerUrl: string,
  query: string,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Indexer returned HTTP ${response.status} for ${label}`);
  }
  const body = await response.text();
  let result: { data?: T };
  try {
    result = JSON.parse(body) as { data?: T };
  } catch {
    throw new Error(`Indexer returned non-JSON for ${label} (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
  if (result?.data == null) {
    throw new Error(`Indexer returned no data for ${label} (got: ${JSON.stringify(result)})`);
  }
  return result.data;
}
