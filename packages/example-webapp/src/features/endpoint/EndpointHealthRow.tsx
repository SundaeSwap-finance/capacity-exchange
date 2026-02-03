import React, { useMemo } from 'react';
import { useEndpointHealth } from './useEndpointHealth';
import type { HealthCheckConfig } from './checkEndpointHealth';
import { EndpointStatusIndicator } from './EndpointStatusIndicator';
import { InfoRow } from '../../shared/ui';

interface EndpointHealthRowProps {
  label: string;
  url: string;
  healthPath: string;
  readyPath?: string;
}

export function EndpointHealthRow({ label, url, healthPath, readyPath }: EndpointHealthRowProps) {
  const config = useMemo<HealthCheckConfig>(() => ({ healthPath, readyPath }), [healthPath, readyPath]);
  const status = useEndpointHealth(url, config);

  return (
    <div className="flex items-center gap-2">
      <EndpointStatusIndicator status={status} />
      <InfoRow label={label} value={url} />
    </div>
  );
}
