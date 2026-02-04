import React from 'react';
import { useEndpointHealth } from './useEndpointHealth';
import type { EndpointConfig, EndpointStatus, EndpointStatusType } from './types';
import { Tooltip } from '../../shared/ui';

const statusStyles: Record<EndpointStatusType, { bg: string; label: string }> = {
  online: { bg: 'bg-green-400', label: 'Online' },
  starting: { bg: 'bg-yellow-400', label: 'Starting' },
  offline: { bg: 'bg-red-400', label: 'Offline' },
  loading: { bg: 'bg-dark-500 animate-pulse', label: 'Checking...' },
};

function StatusIndicator({ status }: { status: EndpointStatus }) {
  const { bg, label } = statusStyles[status.status];
  const tooltip = status.details ? `${label}: ${status.details}` : label;

  return (
    <Tooltip content={tooltip}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${bg} cursor-help`} />
    </Tooltip>
  );
}

interface EndpointHealthRowProps {
  endpoint: EndpointConfig;
  refreshInterval?: number;
}

export function EndpointHealthRow({ endpoint, refreshInterval }: EndpointHealthRowProps) {
  const status = useEndpointHealth(endpoint, refreshInterval);

  return (
    <div className="flex items-start gap-2">
      <div className="mt-1 flex-shrink-0">
        <StatusIndicator status={status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-dark-500 text-xs">{endpoint.label}</div>
        <div className="font-mono text-dark-300 text-xs break-all">{endpoint.url}</div>
      </div>
    </div>
  );
}
