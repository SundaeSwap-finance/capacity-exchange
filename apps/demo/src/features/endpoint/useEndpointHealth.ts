import { useState, useEffect, useCallback } from 'react';
import { checkEndpointHealth } from './checkEndpointHealth';
import type { EndpointConfig, EndpointStatus } from './types';

const LOADING_STATUS: EndpointStatus = { status: 'loading' };

export function useEndpointHealth(endpoint: EndpointConfig, refreshInterval?: number): EndpointStatus {
  const [status, setStatus] = useState<EndpointStatus>(LOADING_STATUS);

  const fetchHealth = useCallback(async () => {
    const endpointStatus = await checkEndpointHealth(endpoint);
    setStatus(endpointStatus);
  }, [endpoint]);

  useEffect(() => {
    fetchHealth();

    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchHealth, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchHealth, refreshInterval]);

  return status;
}
