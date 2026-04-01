/**
 * Retries an async function when it fails with a dust-proof-related error.
 * Error 170 (InvalidDustProof) is a timing issue where the dust merkle tree
 * has advanced between proof creation and submission. Retrying usually works
 * because the next attempt will use a fresh proof.
 */
export async function withDustRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, onRetry }: { maxAttempts?: number; onRetry?: (attempt: number, error: unknown) => void } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isDustProofError(err)) {
        onRetry?.(attempt, err);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function isDustProofError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message + (err.cause instanceof Error ? ' ' + err.cause.message : '');
  return /170|InvalidDustProof|dust.*proof/i.test(msg);
}
