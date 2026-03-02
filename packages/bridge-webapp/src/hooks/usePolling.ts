import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingOptions {
  /** The async function to call on each poll. */
  action: () => Promise<void>;
  /** Whether polling is active. */
  enabled: boolean;
  /** Polling interval in milliseconds. */
  intervalMs: number;
}

/** Generic polling hook. Calls `action` immediately when enabled, then on an interval. */
export function usePolling({ action, enabled, intervalMs }: UsePollingOptions) {
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    poll();
    intervalRef.current = window.setInterval(poll, intervalMs);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, poll, intervalMs]);

  return { loading };
}
