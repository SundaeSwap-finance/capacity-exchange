import { useState, useCallback } from 'react';

interface AsyncActionState<T> {
  result: T | null;
  error: string | null;
  loading: boolean;
  run: () => Promise<void>;
}

/** Wraps an async action with loading/result/error state. Resets on each `run` call. */
export function useAsyncAction<T>(action: () => Promise<T>): AsyncActionState<T> {
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      setResult(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [action]);

  return { result, error, loading, run };
}
