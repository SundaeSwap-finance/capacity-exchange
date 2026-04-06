import { useState, useEffect } from 'react';

interface UseApiOptions {
  pollInterval?: number;
}

export function useApi<T>(apiCall: () => Promise<T>, deps: unknown[] = [], options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiCall();
        setData(response);
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    fetchData();

    if (options.pollInterval) {
      const intervalId = setInterval(fetchData, options.pollInterval);
      return () => clearInterval(intervalId);
    }
  }, [...deps, options.pollInterval]);

  return { data, error };
}
