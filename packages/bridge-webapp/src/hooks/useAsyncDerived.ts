import { useState, useEffect } from 'react';

export interface AsyncDerivedResult<R> {
  data: R | null;
  error: string | null;
}

/** Runs an async function when `input` changes. Returns `{ data, error }`, both null while pending or when input is null. */
export function useAsyncDerived<T, R>(input: T | null, derive: (input: T) => Promise<R>): AsyncDerivedResult<R> {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    derive(input)
      .then((r) => {
        if (!cancelled) {
          setData(r);
        }
      })
      .catch((err) => {
        console.error('useAsyncDerived error:', err);
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input, derive]);

  return { data, error };
}
