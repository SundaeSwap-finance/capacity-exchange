import { useState, useEffect } from 'react';

export function useAsyncDerived<T, R>(input: T | null, derive: (input: T) => Promise<R>): R | null {
  const [result, setResult] = useState<R | null>(null);

  useEffect(() => {
    if (!input) {
      setResult(null);
      return;
    }
    let cancelled = false;
    derive(input)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
        }
      })
      .catch((err) => {
        console.error('useAsyncDerived error:', err);
        if (!cancelled) {
          setResult(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input, derive]);

  return result;
}
