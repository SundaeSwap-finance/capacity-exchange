import { useState, useEffect } from 'react';

interface UseApiOptions {
  pollInterval?: number;
}

export function useApi<T>(apiCall: () => Promise<T>, deps: any[] = [], options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiCall();
        setData(response);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    };

    fetchData();

    if (options.pollInterval) {
      const intervalId = setInterval(fetchData, options.pollInterval);
      return () => clearInterval(intervalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, options.pollInterval]);

  return { data, error };
}
