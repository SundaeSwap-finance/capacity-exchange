import { useState, useEffect, useCallback } from 'react';
import { getCounterValue } from '../features/ces/counterContract';
import type { NetworkConfig } from '../config';

export interface UseCounterValueResult {
  value: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useCounterValue(
  counterAddress: string | null,
  config: NetworkConfig
): UseCounterValueResult {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!counterAddress) return;
    setLoading(true);
    try {
      const result = await getCounterValue(counterAddress, config);
      setValue(result.round);
    } catch {
      // keep previous value on error
    } finally {
      setLoading(false);
    }
  }, [counterAddress, config]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { value, loading, refresh };
}
