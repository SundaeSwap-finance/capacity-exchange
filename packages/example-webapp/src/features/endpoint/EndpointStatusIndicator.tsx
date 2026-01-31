import React from 'react';
import type { EndpointStatus } from './types';
import { LoadingSpinner } from '../../shared/ui';

interface EndpointStatusIndicatorProps {
  status: EndpointStatus;
}

const statusConfig: Record<Exclude<EndpointStatus, 'loading'>, { color: string; label: string }> = {
  online: { color: 'green', label: 'Online' },
  starting: { color: 'yellow', label: 'Starting' },
  offline: { color: 'red', label: 'Offline' },
};

export function EndpointStatusIndicator({ status }: EndpointStatusIndicatorProps) {
  if (status === 'loading') {
    return <LoadingSpinner message="Loading" size="sm" />;
  }

  const { color, label } = statusConfig[status];

  return (
    <span className={`flex items-center gap-2 text-${color}-400`}>
      <span className={`h-2 w-2 rounded-full bg-${color}-400`} />
      {label}
    </span>
  );
}
