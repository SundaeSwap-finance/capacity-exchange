import React from 'react';
import type { EndpointConfig } from './types';
import { InfoIcon, Tooltip } from '../../shared/ui';
import { EndpointHealthRow } from './EndpointHealthRow';

interface EndpointsListProps {
  endpoints: EndpointConfig[];
  refreshInterval: number;
}

export function EndpointsList({ endpoints, refreshInterval }: EndpointsListProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-dark-500 text-sm">Endpoints</span>
        <Tooltip content={`Auto-refreshes every ${refreshInterval / 1000}s`} position="top">
          <InfoIcon className="w-3.5 h-3.5 text-dark-500 cursor-help" />
        </Tooltip>
      </div>
      <div className="space-y-3">
        {endpoints.map((endpoint) => (
          <EndpointHealthRow key={endpoint.label} endpoint={endpoint} refreshInterval={refreshInterval} />
        ))}
      </div>
    </>
  );
}
