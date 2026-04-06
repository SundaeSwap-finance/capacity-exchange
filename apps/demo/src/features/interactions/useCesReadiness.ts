import { useCallback, useEffect, useState } from 'react';
import { useCesClient } from '../../config';
import { checkCesHealth } from '@capacity-exchange/providers';

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
    const health = await checkCesHealth(api);

    if (health.status === 'syncing') {
      setState({ status: 'syncing' });
      return;
    }
    if (health.status === 'offline') {
      setState({ status: 'offline', error: health.error });
      return;
    }

    if (!tokenColor) {
      setState({ status: 'ready', hasCurrency: false });
      return;
    }

    try {
      const pricesData = await api.apiPricesGet({ specks: '1' });
      const hasCurrency = pricesData.prices.some((p) => p.currency === tokenColor);
      setState({ status: 'ready', hasCurrency });
    } catch {
      setState({ status: 'offline', error: 'Failed to fetch prices' });
    }
  }, [api, tokenColor]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [check]);

  return state;
}
