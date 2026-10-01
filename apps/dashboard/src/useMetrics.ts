import { useCallback, useEffect, useRef, useState } from 'react';

export interface CapacityMetrics {
  asset: string;
  available: string;
  consumedTotal: string;
  consumedLastHour: string;
  locksLastHour: number;
  contention: {
    lockedUtxos: number;
    totalUtxos: number;
    lockedAmount: string;
    ratio: number;
    averageRatioLastHour: number;
  };
}

export interface Metrics {
  server: {
    name: string;
    version: string;
    uptime: number;
  };
  capacity: CapacityMetrics[];
  revenue: {
    byCurrency: Record<string, string>;
  };
  networks: string[];
  readiness: string;
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
    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    try {
      const [metricsRes, rootRes, readyRes] = await Promise.all([
        fetch(`${API_URL}/api/metrics`),
        fetch(`${API_URL}/`),
        fetch(`${API_URL}/health/ready`),
      ]);
      for (const res of [metricsRes, rootRes]) {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
      }
      // A server that isn't ready answers 500/503, still with a status body.
      const [metrics, root, ready] = await Promise.all([metricsRes.json(), rootRes.json(), readyRes.json()]);
      const networks = Object.entries(root.chains as Record<string, { network: string }>).map(
        ([chain, info]) => `${chain}: ${info.network}`
      );
      const data: Metrics = { ...metrics, networks, readiness: ready.status };
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
