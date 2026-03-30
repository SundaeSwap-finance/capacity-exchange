import { useCallback, useEffect, useRef, useState } from 'react';

export interface Metrics {
  server: {
    name: string;
    version: string;
    uptime: number;
    network: string;
  };
  health: {
    wallet: { status: string };
  };
}

interface MetricsState {
  data: Metrics | null;
  error: boolean;
  secondsUntilRefresh: number;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function useMetrics(intervalSeconds = 5): MetricsState {
  const [state, setState] = useState<MetricsState>({ data: null, error: false, secondsUntilRefresh: 0 });
  const countdownRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchMetrics = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      const data: Metrics = await res.json();
      countdownRef.current = intervalSeconds;
      setState({ data, error: false, secondsUntilRefresh: intervalSeconds });
    } catch {
      countdownRef.current = intervalSeconds;
      setState((prev) => ({ ...prev, error: true, secondsUntilRefresh: intervalSeconds }));
    } finally {
      fetchingRef.current = false;
    }
  }, [intervalSeconds]);

  useEffect(() => {
    fetchMetrics();

    const tickId = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        fetchMetrics();
      } else {
        setState((prev) => ({ ...prev, secondsUntilRefresh: countdownRef.current }));
      }
    }, 1000);

    return () => clearInterval(tickId);
  }, [fetchMetrics]);

  return state;
}
