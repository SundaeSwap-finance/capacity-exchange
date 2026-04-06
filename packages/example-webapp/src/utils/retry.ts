const COUNTERS_URL = 'https://api.counters.sundaeswap.finance/api/v0/increment';

/**
 * Retries an async function when it fails with a dust-proof-related error.
 * Errors 170 (InvalidDustProof) and 182 are timing issues where the dust
 * merkle tree has advanced between proof creation and submission. Retrying
 * usually works because the next attempt will use a fresh proof.
 */
export async function withDustRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, onRetry }: { maxAttempts?: number; onRetry?: (attempt: number, error: unknown) => void } = {}
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errorCode = getDustErrorCode(err);
      if (errorCode) {
        trackDustError(errorCode);
      }
      if (attempt < maxAttempts && errorCode) {
        onRetry?.(attempt, err);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function getDustErrorCode(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return null;
  }
  const msg = err.message + (err.cause instanceof Error ? ' ' + err.cause.message : '');
  if (/170|InvalidDustProof|dust.*proof/i.test(msg)) {
    return '170';
  }
  if (/182/.test(msg)) {
    return '182';
  }
  return null;
}

function trackDustError(code: string): void {
  fetch(`${COUNTERS_URL}/ces-error-${code}`, { method: 'POST' }).catch(() => {});
}
