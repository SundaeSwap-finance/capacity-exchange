import { readdirSync } from 'fs';
import { join } from 'path';

/** Picks a Content-Type based on file extension. */
export function contentTypeFor(filename: string): string {
  return filename.endsWith('.json') ? 'application/json' : 'application/octet-stream';
}

/** Returns absolute paths of every file under rootDir (recursive). */
export function walkFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Runs `op` on every item in parallel via Promise.allSettled. If any item rejects,
 * throws with a single message that includes all failure reasons and the first failure
 * chained as `cause` so the underlying stack survives. Otherwise returns the fulfilled
 * values in input order.
 */
export async function parallelAllOrThrow<T, R>(
  items: T[],
  op: (item: T) => Promise<R>,
  errorPrefix: string
): Promise<R[]> {
  const results = await Promise.allSettled(items.map(op));
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  if (failed.length > 0) {
    const reasons = failed.map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))).join(', ');
    throw new Error(`${errorPrefix}: ${failed.length}/${results.length} failed. Reasons: ${reasons}`, {
      cause: failed[0].reason,
    });
  }
  return results.map((r) => (r as PromiseFulfilledResult<R>).value);
}
