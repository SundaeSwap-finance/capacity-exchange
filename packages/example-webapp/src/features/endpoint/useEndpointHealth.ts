import { useState, useEffect, useCallback } from 'react';
import { checkEndpointHealth, type HealthCheckConfig } from './checkEndpointHealth';
import type { EndpointStatus } from './types';

export function useEndpointHealth(url: string, config: HealthCheckConfig): EndpointStatus {
  const [status, setStatus] = useState<EndpointStatus>('loading');

  const fetchHealth = useCallback(async () => {
    setStatus('loading');
    const endpointStatus = await checkEndpointHealth(url, config);
    setStatus(endpointStatus);
  }, [url, config]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return status;
}
