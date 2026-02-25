import { useState, useEffect, useCallback } from 'react';
import { useCesClient } from '../../config';
import { ResponseError } from '@capacity-exchange/client';

export type CesReadiness =
  | { status: 'loading' }
  | { status: 'offline'; error: string }
  | { status: 'syncing' }
  | { status: 'ready'; hasCurrency: boolean };

const POLL_INTERVAL = 1_000;

// TODO: Use this for a list of CE services, to prove it works against multiple
export function useCesReadiness(tokenColor: string | null): CesReadiness {
  const api = useCesClient();
  const [state, setState] = useState<CesReadiness>({ status: 'loading' });

  const check = useCallback(async () => {
    try {
      await api.healthGet();

      // Readiness check — 503 means syncing (throws ResponseError)
      let readyData;
      try {
        readyData = await api.healthReadyGet();
      } catch (err) {
        if (err instanceof ResponseError && err.response.status === 503) {
          setState({ status: 'syncing' });
          return;
        }
        throw err;
      }

      if (readyData.status === 'syncing') {
        setState({ status: 'syncing' });
        return;
      }
      if (readyData.status !== 'ok') {
        setState({ status: 'offline', error: `CES status: ${readyData.status}` });
        return;
      }

      if (!tokenColor) {
        setState({ status: 'ready', hasCurrency: false });
        return;
      }

      const pricesData = await api.apiPricesGet({ specks: '1' });
      const hasCurrency = pricesData.prices.some((p) => p.currency === tokenColor);
      setState({ status: 'ready', hasCurrency });
    } catch (err) {
      if (err instanceof ResponseError) {
        setState({ status: 'offline', error: `HTTP ${err.response.status}` });
      } else {
        setState({ status: 'offline', error: err instanceof Error ? err.message : 'Connection failed' });
      }
    }
  }, [api, tokenColor]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [check]);

  return state;
}
